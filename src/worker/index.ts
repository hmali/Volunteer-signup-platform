#!/usr/bin/env node

/**
 * Background Worker Service
 * Polls SQS queue and processes jobs (Sheets sync + email sending)
 */

import { pollQueue, deleteMessage, moveToDeadLetterQueue, JobType, type Job } from '../lib/queue';
import { getSignupById } from '../lib/signup';
import { upsertSignupToSheet, markSignupCancelledInSheet } from '../lib/sheets';
import { sendConfirmationEmail, sendCancellationEmail } from '../lib/email';
import { prisma } from '../lib/db';
import { logger, retryWithBackoff } from '../lib/utils';

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '5000');
const MAX_RETRIES = parseInt(process.env.WORKER_MAX_RETRIES || '5');
const RETRY_BACKOFF_MS = parseInt(process.env.WORKER_RETRY_BACKOFF_MS || '1000');

let isRunning = true;
let currentJobCount = 0;

// ============================================================================
// JOB PROCESSORS
// ============================================================================

async function processSheetsSyncJob(job: Job): Promise<void> {
  logger.info('Processing Sheets sync job', { jobType: job.type, signupId: job.signupId });

  const signup = await getSignupById(job.signupId);
  
  let rowId: number;
  if (job.type === JobType.SHEETS_UPSERT_SIGNUP) {
    rowId = await upsertSignupToSheet(signup);
  } else {
    await markSignupCancelledInSheet(signup);
    rowId = -1; // Already exists
  }

  // Update sync log
  await prisma.exportSyncLog.upsert({
    where: {
      signupId: job.signupId,
    },
    create: {
      signupId: job.signupId,
      sheetsSpreadsheetId: signup.slot.day.event.sheetsSpreadsheetId,
      sheetsRowId: rowId,
      sheetsSyncedAt: new Date(),
      status: 'SUCCESS',
    },
    update: {
      sheetsSpreadsheetId: signup.slot.day.event.sheetsSpreadsheetId,
      sheetsRowId: rowId > 0 ? rowId : undefined,
      sheetsSyncedAt: new Date(),
      status: 'SUCCESS',
      lastError: null,
    },
  });

  logger.info('Sheets sync completed', { signupId: job.signupId, rowId });
}

async function processEmailJob(job: Job): Promise<void> {
  logger.info('Processing email job', { jobType: job.type, signupId: job.signupId });

  const signup = await getSignupById(job.signupId);
  
  // Check if email already sent (idempotency)
  const notificationType = job.type === JobType.EMAIL_CONFIRMATION ? 'CONFIRMATION' : 'CANCELLATION';
  const existing = await prisma.notificationLog.findFirst({
    where: {
      signupId: job.signupId,
      type: notificationType,
      status: 'SENT',
    },
  });

  if (existing) {
    logger.info('Email already sent, skipping', { signupId: job.signupId, type: notificationType });
    return;
  }

  let messageId: string;
  if (job.type === JobType.EMAIL_CONFIRMATION) {
    messageId = await sendConfirmationEmail(signup);
  } else {
    messageId = await sendCancellationEmail(signup);
  }

  // Log notification
  await prisma.notificationLog.create({
    data: {
      signupId: job.signupId,
      type: notificationType,
      recipient: signup.email,
      status: 'SENT',
      sentAt: new Date(),
      providerMessageId: messageId,
    },
  });

  logger.info('Email sent', { signupId: job.signupId, messageId });
}

// ============================================================================
// MAIN JOB PROCESSOR
// ============================================================================

async function processJob(job: Job, receiptHandle: string, retryCount: number = 0): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Process based on job type
    if (job.type === JobType.SHEETS_UPSERT_SIGNUP || job.type === JobType.SHEETS_MARK_CANCELLED) {
      await retryWithBackoff(() => processSheetsSyncJob(job), 3, RETRY_BACKOFF_MS);
    } else if (job.type === JobType.EMAIL_CONFIRMATION || job.type === JobType.EMAIL_CANCELLATION) {
      await retryWithBackoff(() => processEmailJob(job), 3, RETRY_BACKOFF_MS);
    } else {
      logger.warn('Unknown job type', { jobType: job.type });
    }

    // Delete message from queue (success)
    await deleteMessage(receiptHandle);
    
    const duration = Date.now() - startTime;
    logger.info('Job processed successfully', {
      jobType: job.type,
      signupId: job.signupId,
      duration,
      retryCount,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Job processing failed', {
      jobType: job.type,
      signupId: job.signupId,
      error: errorMessage,
      duration,
      retryCount,
    });

    // Check if max retries exceeded
    if (retryCount >= MAX_RETRIES) {
      logger.error('Max retries exceeded, moving to DLQ', {
        jobType: job.type,
        signupId: job.signupId,
      });

      // Update sync log as failed
      await prisma.exportSyncLog.upsert({
        where: { signupId: job.signupId },
        create: {
          signupId: job.signupId,
          status: 'FAILED',
          lastError: errorMessage,
          retryCount,
        },
        update: {
          status: 'FAILED',
          lastError: errorMessage,
          retryCount,
          lastAttemptedAt: new Date(),
        },
      });

      // Move to DLQ
      await moveToDeadLetterQueue(job, errorMessage);
      await deleteMessage(receiptHandle);
    } else {
      // Let SQS retry (don't delete message, it will become visible again)
      logger.info('Job will be retried', {
        jobType: job.type,
        signupId: job.signupId,
        nextRetry: retryCount + 1,
      });
    }
  }
}

// ============================================================================
// WORKER LOOP
// ============================================================================

async function workerLoop(): Promise<void> {
  logger.info('Worker started', {
    pollInterval: POLL_INTERVAL_MS,
    maxRetries: MAX_RETRIES,
  });

  while (isRunning) {
    try {
      // Poll for messages (long polling - waits up to 20 seconds)
      const messages = await pollQueue(1, 20);

      if (messages.length === 0) {
        // No messages, continue polling
        continue;
      }

      for (const { message, job } of messages) {
        currentJobCount++;
        const retryCount = parseInt(message.Attributes?.ApproximateReceiveCount || '0') - 1;
        
        await processJob(job, message.ReceiptHandle!, retryCount);
        currentJobCount--;
      }

    } catch (error) {
      logger.error('Worker loop error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  logger.info('Worker stopped');
}

// ============================================================================
// HEALTH CHECK SERVER
// ============================================================================

import http from 'http';

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      uptime: process.uptime(),
      currentJobs: currentJobCount,
      timestamp: new Date().toISOString(),
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || '3001');
healthServer.listen(HEALTH_PORT, () => {
  logger.info('Health check server started', { port: HEALTH_PORT });
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

function shutdown(signal: string): void {
  logger.info('Shutdown signal received', { signal });
  isRunning = false;

  // Wait for current jobs to complete (max 30 seconds)
  const shutdownTimeout = setTimeout(() => {
    logger.warn('Shutdown timeout, forcing exit');
    process.exit(1);
  }, 30000);

  // Wait for current jobs
  const checkInterval = setInterval(() => {
    if (currentJobCount === 0) {
      clearInterval(checkInterval);
      clearTimeout(shutdownTimeout);
      
      healthServer.close(() => {
        logger.info('Worker shutdown complete');
        process.exit(0);
      });
    }
  }, 100);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================================================
// START WORKER
// ============================================================================

workerLoop().catch(error => {
  logger.error('Worker crashed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
