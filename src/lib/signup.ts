import { Prisma } from '@prisma/client';
import { prisma } from './db';
import crypto from 'crypto';
import { writeSignupToS3 } from './s3';
import { enqueueSignupJobs, enqueueCancellationJobs } from './queue';

export interface SignupData {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

export class SignupError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'SignupError';
  }
}

/**
 * Create a new signup with race-safe capacity enforcement
 * CRITICAL: Uses database row-level locking to prevent overbooking
 */
export async function createSignup(slotId: string, data: SignupData) {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    throw new SignupError('Invalid email address', 'INVALID_EMAIL', 400);
  }

  // Validate name
  if (data.name.trim().length < 2) {
    throw new SignupError('Name must be at least 2 characters', 'INVALID_NAME', 400);
  }

  // Generate secure cancellation token
  const cancelToken = crypto.randomBytes(32).toString('hex');
  const cancelTokenHash = crypto
    .createHash('sha256')
    .update(cancelToken)
    .digest('hex');

  // Execute in transaction with row-level locking
  const result = await prisma.$transaction(async (tx) => {
    // 1. Lock the slot row (FOR UPDATE)
    // This prevents other transactions from reading until we commit
    const [lockedSlot] = await tx.$queryRaw<any[]>`
      SELECT * FROM "slots"
      WHERE id = ${slotId}
      FOR UPDATE
    `;

    if (!lockedSlot) {
      throw new SignupError('Slot not found', 'SLOT_NOT_FOUND', 404);
    }

    // 2. Check capacity (with locked data)
    if (lockedSlot.filledCount >= lockedSlot.capacity) {
      throw new SignupError(
        'This slot is full. Please choose another slot or date.',
        'SLOT_FULL',
        409
      );
    }

    // 3. Check if slot is closed
    if (lockedSlot.status !== 'ACTIVE') {
      throw new SignupError(
        'This slot is no longer available',
        'SLOT_CLOSED',
        410
      );
    }

    // 4. Load full slot details (with relations)
    const slot = await tx.slot.findUnique({
      where: { id: slotId },
      include: {
        day: {
          include: {
            event: true,
          },
        },
        sevaType: true,
      },
    });

    if (!slot) {
      throw new SignupError('Slot not found', 'SLOT_NOT_FOUND', 404);
    }

    // 5. Check if day is closed
    if (slot.day.isClosed) {
      throw new SignupError(
        'This date is closed for signups',
        'DAY_CLOSED',
        410
      );
    }

    // 6. Check for duplicate signup (same email + slot)
    const existingSignup = await tx.signup.findFirst({
      where: {
        slotId,
        email: data.email.toLowerCase(),
        status: 'CONFIRMED',
      },
    });

    if (existingSignup) {
      throw new SignupError(
        'You have already signed up for this slot',
        'DUPLICATE_SIGNUP',
        409
      );
    }

    // 7. Create signup
    const signup = await tx.signup.create({
      data: {
        slotId,
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        phone: data.phone?.trim() || null,
        notes: data.notes?.trim() || null,
        cancelToken,
        cancelTokenHash,
        status: 'CONFIRMED',
      },
      include: {
        slot: {
          include: {
            day: {
              include: {
                event: true,
              },
            },
            sevaType: true,
          },
        },
      },
    });

    // 8. Increment filled count
    await tx.slot.update({
      where: { id: slotId },
      data: {
        filledCount: { increment: 1 },
        status: lockedSlot.filledCount + 1 >= lockedSlot.capacity ? 'FULL' : 'ACTIVE',
      },
    });

    return signup;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 10000, // 10 seconds
  });

  // 9. Write to S3 (synchronous but fast ~50-100ms)
  try {
    const s3Key = await writeSignupToS3(result);
    
    // Log S3 sync success
    await prisma.exportSyncLog.create({
      data: {
        signupId: result.id,
        s3Key,
        s3SyncedAt: new Date(),
        status: 'SUCCESS',
      },
    });
  } catch (error) {
    console.error('[Signup] S3 write failed:', error);
    // Don't fail the signup if S3 fails - log and continue
    await prisma.exportSyncLog.create({
      data: {
        signupId: result.id,
        status: 'FAILED',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        retryCount: 0,
      },
    });
  }

  // 10. Enqueue background jobs (async - Sheets sync + email)
  try {
    await enqueueSignupJobs(result.id);
  } catch (error) {
    console.error('[Signup] Failed to enqueue jobs:', error);
    // Log but don't fail the signup
  }

  return result;
}

/**
 * Cancel a signup using secure token
 */
export async function cancelSignup(token: string) {
  // Hash the token to match against DB
  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Execute in transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Find signup by token hash
    const signup = await tx.signup.findUnique({
      where: { cancelTokenHash: tokenHash },
      include: {
        slot: {
          include: {
            day: {
              include: {
                event: true,
              },
            },
            sevaType: true,
          },
        },
      },
    });

    if (!signup) {
      throw new SignupError(
        'Invalid or expired cancellation link',
        'INVALID_TOKEN',
        404
      );
    }

    // 2. Check if already cancelled
    if (signup.status === 'CANCELLED') {
      throw new SignupError(
        'This signup has already been cancelled',
        'ALREADY_CANCELLED',
        410
      );
    }

    // 3. Lock slot for update
    await tx.$queryRaw`
      SELECT * FROM "slots"
      WHERE id = ${signup.slotId}
      FOR UPDATE
    `;

    // 4. Update signup status
    const updatedSignup = await tx.signup.update({
      where: { id: signup.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
      include: {
        slot: {
          include: {
            day: {
              include: {
                event: true,
              },
            },
            sevaType: true,
          },
        },
      },
    });

    // 5. Decrement filled count
    await tx.slot.update({
      where: { id: signup.slotId },
      data: {
        filledCount: { decrement: 1 },
        status: 'ACTIVE', // Reopen slot
      },
    });

    return updatedSignup;
  });

  // 6. Update S3 (add cancelledAt)
  try {
    await writeSignupToS3(result);
  } catch (error) {
    console.error('[Cancel] S3 write failed:', error);
  }

  // 7. Enqueue background jobs (Sheets + email)
  try {
    await enqueueCancellationJobs(result.id);
  } catch (error) {
    console.error('[Cancel] Failed to enqueue jobs:', error);
  }

  return result;
}

/**
 * Get signup by ID (for worker/admin)
 */
export async function getSignupById(signupId: string) {
  const signup = await prisma.signup.findUnique({
    where: { id: signupId },
    include: {
      slot: {
        include: {
          day: {
            include: {
              event: true,
            },
          },
          sevaType: true,
        },
      },
    },
  });

  if (!signup) {
    throw new SignupError('Signup not found', 'NOT_FOUND', 404);
  }

  return signup;
}
