import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, Message } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const QUEUE_URL = process.env.SQS_QUEUE_URL!;
const DLQ_URL = process.env.SQS_DLQ_URL;

// ============================================================================
// JOB TYPES
// ============================================================================

export enum JobType {
  SHEETS_UPSERT_SIGNUP = 'SHEETS_UPSERT_SIGNUP',
  SHEETS_MARK_CANCELLED = 'SHEETS_MARK_CANCELLED',
  EMAIL_CONFIRMATION = 'EMAIL_CONFIRMATION',
  EMAIL_CANCELLATION = 'EMAIL_CANCELLATION',
}

export interface Job {
  type: JobType;
  signupId: string;
  retryCount?: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// PRODUCER (Enqueue jobs)
// ============================================================================

/**
 * Enqueue a background job to SQS
 */
export async function enqueueJob(job: Job): Promise<string> {
  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(job),
    MessageAttributes: {
      JobType: {
        DataType: 'String',
        StringValue: job.type,
      },
      SignupId: {
        DataType: 'String',
        StringValue: job.signupId,
      },
    },
  });

  const response = await sqsClient.send(command);
  console.log(`[SQS] Enqueued job ${job.type} for signup ${job.signupId}, MessageId: ${response.MessageId}`);
  
  return response.MessageId!;
}

/**
 * Enqueue multiple jobs at once (for signup: sheets + email)
 */
export async function enqueueSignupJobs(signupId: string): Promise<void> {
  const jobs: Job[] = [
    { type: JobType.SHEETS_UPSERT_SIGNUP, signupId },
    { type: JobType.EMAIL_CONFIRMATION, signupId },
  ];

  await Promise.all(jobs.map(job => enqueueJob(job)));
}

/**
 * Enqueue cancellation jobs
 */
export async function enqueueCancellationJobs(signupId: string): Promise<void> {
  const jobs: Job[] = [
    { type: JobType.SHEETS_MARK_CANCELLED, signupId },
    { type: JobType.EMAIL_CANCELLATION, signupId },
  ];

  await Promise.all(jobs.map(job => enqueueJob(job)));
}

// ============================================================================
// CONSUMER (Poll and process jobs)
// ============================================================================

export interface QueueMessage {
  message: Message;
  job: Job;
}

/**
 * Poll SQS for messages (used by worker)
 */
export async function pollQueue(maxMessages: number = 1, waitTimeSeconds: number = 20): Promise<QueueMessage[]> {
  const command = new ReceiveMessageCommand({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: maxMessages,
    WaitTimeSeconds: waitTimeSeconds, // Long polling
    MessageAttributeNames: ['All'],
    AttributeNames: ['All'],
  });

  const response = await sqsClient.send(command);
  const messages = response.Messages || [];

  return messages.map(message => ({
    message,
    job: JSON.parse(message.Body!) as Job,
  }));
}

/**
 * Delete message from queue (after successful processing)
 */
export async function deleteMessage(receiptHandle: string): Promise<void> {
  const command = new DeleteMessageCommand({
    QueueUrl: QUEUE_URL,
    ReceiptHandle: receiptHandle,
  });

  await sqsClient.send(command);
}

/**
 * Move message to DLQ (after max retries exceeded)
 */
export async function moveToDeadLetterQueue(job: Job, error: string): Promise<void> {
  if (!DLQ_URL) {
    console.error('[SQS] DLQ not configured, cannot move failed job', { job, error });
    return;
  }

  const command = new SendMessageCommand({
    QueueUrl: DLQ_URL,
    MessageBody: JSON.stringify({
      ...job,
      error,
      movedToDlqAt: new Date().toISOString(),
    }),
  });

  await sqsClient.send(command);
  console.log(`[SQS] Moved job to DLQ: ${job.type} for signup ${job.signupId}`);
}

export default sqsClient;
