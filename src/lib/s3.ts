import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Signup, Slot, Day, SevaType, Event } from '@prisma/client';

const s3Client = new S3Client({
  region: process.env.S3_BUCKET_REGION || process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

type SignupWithRelations = Signup & {
  slot: Slot & {
    day: Day & {
      event: Event;
    };
    sevaType: SevaType;
  };
};

/**
 * Generate S3 key for a signup
 * Format: events/{publicId}/month={YYYY-MM}/date={YYYY-MM-DD}/slot={slotId}/signup={signupId}.json
 */
export function getS3Key(signup: SignupWithRelations): string {
  const event = signup.slot.day.event;
  const date = signup.slot.day.date;
  const month = date.toISOString().substring(0, 7); // YYYY-MM
  const dateStr = date.toISOString().substring(0, 10); // YYYY-MM-DD

  return `events/${event.publicId}/month=${month}/date=${dateStr}/slot=${signup.slotId}/signup=${signup.id}.json`;
}

/**
 * Write signup data to S3 as JSON
 */
export async function writeSignupToS3(signup: SignupWithRelations): Promise<string> {
  const key = getS3Key(signup);

  // Prepare JSON payload (exclude sensitive hashes)
  const payload = {
    signupId: signup.id,
    slotId: signup.slotId,
    event: {
      id: signup.slot.day.event.id,
      publicId: signup.slot.day.event.publicId,
      name: signup.slot.day.event.name,
      timezone: signup.slot.day.event.timezone,
      shiftLabel: signup.slot.day.event.shiftLabel,
    },
    day: {
      date: signup.slot.day.date.toISOString().substring(0, 10),
      dayOfWeek: signup.slot.day.dayOfWeek,
    },
    seva: {
      name: signup.slot.sevaType.name,
      description: signup.slot.sevaType.description,
    },
    volunteer: {
      name: signup.name,
      email: signup.email,
      phone: signup.phone,
      notes: signup.notes,
    },
    status: signup.status,
    createdAt: signup.createdAt.toISOString(),
    cancelledAt: signup.cancelledAt?.toISOString() || null,
    _metadata: {
      exportedAt: new Date().toISOString(),
      version: '1.0',
    },
  };

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: JSON.stringify(payload, null, 2),
    ContentType: 'application/json',
    ServerSideEncryption: 'AES256', // SSE-S3
    Metadata: {
      signupId: signup.id,
      eventPublicId: signup.slot.day.event.publicId,
      status: signup.status,
    },
  });

  await s3Client.send(command);

  console.log(`[S3] Wrote signup ${signup.id} to ${key}`);
  return key;
}

/**
 * Generate presigned URL for downloading signup JSON (admin only)
 */
export async function getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return url;
}

/**
 * Read signup JSON from S3
 */
export async function readSignupFromS3(key: string): Promise<any> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  const body = await response.Body?.transformToString();
  
  if (!body) {
    throw new Error(`S3 object ${key} has no content`);
  }

  return JSON.parse(body);
}

export default s3Client;
