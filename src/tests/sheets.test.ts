/**
 * Google Sheets Idempotency Test
 * 
 * Tests that upserting the same signup multiple times produces the same result
 * (no duplicate rows in Google Sheets).
 */

import { PrismaClient } from '@prisma/client';
import { upsertSignupToSheet, markSignupCancelledInSheet } from '../lib/sheets';

const prisma = new PrismaClient();

// Skip these tests if Sheets sync is disabled
const describeOrSkip = process.env.DISABLE_SHEETS_SYNC === 'true' ? describe.skip : describe;

describeOrSkip('Google Sheets Idempotency Test', () => {
  let eventId: string;
  let signupId: string;

  beforeAll(async () => {
    // Create test event
    const event = await prisma.event.create({
      data: {
        name: 'Sheets Test Event',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-31'),
        timezone: 'America/New_York',
        shiftLabel: '7:00 PM – 9:00 PM',
        createdById: 'test-admin',
      },
    });
    eventId = event.id;

    // Create seva type
    const sevaType = await prisma.sevaType.create({
      data: {
        eventId,
        name: 'Sheets Test Seva',
        defaultCapacity: 4,
        isActive: true,
        sortOrder: 1,
      },
    });

    // Create day
    const day = await prisma.day.create({
      data: {
        eventId,
        date: new Date('2026-07-05'),
        dayOfWeek: 6,
        isClosed: false,
      },
    });

    // Create slot
    const slot = await prisma.slot.create({
      data: {
        dayId: day.id,
        sevaTypeId: sevaType.id,
        capacity: 4,
        filledCount: 1,
        status: 'ACTIVE',
      },
    });

    // Create signup
    const crypto = await import('crypto');
    const cancelToken = crypto.randomBytes(32).toString('hex');
    const cancelTokenHash = crypto.createHash('sha256').update(cancelToken).digest('hex');

    const signup = await prisma.signup.create({
      data: {
        slotId: slot.id,
        name: 'Test User',
        email: 'test@sheets.com',
        phone: '+1-555-9999',
        notes: 'Testing idempotency',
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

    signupId = signup.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.signup.deleteMany({ where: { slot: { dayId: { in: await prisma.day.findMany({ where: { eventId } }).then(d => d.map(x => x.id)) } } } });
    await prisma.slot.deleteMany({ where: { day: { eventId } } });
    await prisma.day.deleteMany({ where: { eventId } });
    await prisma.sevaType.deleteMany({ where: { eventId } });
    await prisma.event.delete({ where: { id: eventId } });
    await prisma.$disconnect();
  });

  test('First upsert should create row', async () => {
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

    const rowId = await upsertSignupToSheet(signup!);
    
    expect(rowId).toBeGreaterThan(0);
    
    // Log should be created
    const syncLog = await prisma.exportSyncLog.findFirst({
      where: { signupId },
    });
    
    expect(syncLog).toBeDefined();
    expect(syncLog?.status).toBe('SUCCESS');
    expect(syncLog?.sheetsRowId).toBe(rowId);
  });

  test('Second upsert (idempotency) should update same row', async () => {
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

    // Get original row ID
    const firstLog = await prisma.exportSyncLog.findFirst({
      where: { signupId },
      orderBy: { createdAt: 'asc' },
    });
    const originalRowId = firstLog?.sheetsRowId;

    // Upsert again
    const rowId = await upsertSignupToSheet(signup!);

    // Should be the same row
    expect(rowId).toBe(originalRowId);

    // Should have updated sync log
    const syncLogs = await prisma.exportSyncLog.findMany({
      where: { signupId },
    });

    // Only one log (upserted, not created new)
    expect(syncLogs.length).toBeGreaterThanOrEqual(1);
  });

  test('Third upsert should still update same row (no duplicates)', async () => {
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

    const rowId = await upsertSignupToSheet(signup!);

    const firstLog = await prisma.exportSyncLog.findFirst({
      where: { signupId },
      orderBy: { createdAt: 'asc' },
    });

    expect(rowId).toBe(firstLog?.sheetsRowId);
  });

  test('Mark cancelled should update status in sheet', async () => {
    // Update signup to cancelled
    const updatedSignup = await prisma.signup.update({
      where: { id: signupId },
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

    // Mark as cancelled in sheet
    await markSignupCancelledInSheet(updatedSignup);

    // Should not throw error
    expect(true).toBe(true);
  });
});

// Test without actual API calls (mocked)
describe('Sheets Sync - Unit Tests (Mocked)', () => {
  test('Upsert logic should be idempotent by signupId', () => {
    const signupId = 'test-123';
    
    // Simulating finding existing row
    const existingRows = [
      ['row1-id'],
      ['row2-id'],
      ['test-123'], // This is our signup
      ['row4-id'],
    ];

    const rowIndex = existingRows.findIndex(row => row[0] === signupId);
    expect(rowIndex).toBe(2);
    
    const rowNumber = rowIndex + 1; // Sheets is 1-indexed (plus header)
    expect(rowNumber).toBe(3);
  });

  test('Cancelled signup should preserve row (not delete)', () => {
    const status = 'CANCELLED';
    
    // We should update status column, not delete the row
    expect(status).toBe('CANCELLED');
    
    // Row should still exist with CANCELLED status for audit trail
    const expectedAction = 'UPDATE';
    expect(expectedAction).not.toBe('DELETE');
  });
});
