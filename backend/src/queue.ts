import dotenv from 'dotenv';
dotenv.config();

import { Queue, QueueEvents } from 'bullmq';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

console.log(`[QUEUE] REDIS_HOST=${REDIS_HOST} REDIS_PORT=${REDIS_PORT}`);

// BullMQ v5 requires maxRetriesPerRequest: null.
// Do NOT add lazyConnect, retryStrategy, or enableReadyCheck —
// those conflict with BullMQ's internal connection management.
export const connection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
};

export const JOB_QUEUE_NAME = 'distributed-job-queue';
console.log(`[QUEUE] Queue name = "${JOB_QUEUE_NAME}"`);

export const jobQueue = new Queue(JOB_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 86400,
      count: 5000,
    },
  },
});

console.log(`[QUEUE] BullMQ Queue "${JOB_QUEUE_NAME}" initialized`);

export const queueEvents = new QueueEvents(JOB_QUEUE_NAME, { connection });

queueEvents.on('waiting', ({ jobId }) => {
  console.log(`[QUEUE] waiting jobId=${jobId}`);
});

queueEvents.on('active', ({ jobId, prev }) => {
  console.log(`[QUEUE] active jobId=${jobId} prev=${prev}`);
});

queueEvents.on('completed', ({ jobId }) => {
  console.log(`[QUEUE] completed jobId=${jobId}`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`[QUEUE] failed jobId=${jobId} reason=${failedReason}`);
});

export async function inspectQueueState() {
  try {
    const waiting = await jobQueue.getWaiting();
    const active = await jobQueue.getActive();
    const delayed = await jobQueue.getDelayed();
    const failed = await jobQueue.getFailed();
    const completed = await jobQueue.getCompleted();

    console.log(`[QUEUE INSPECT] waiting=${waiting.length} active=${active.length} delayed=${delayed.length} failed=${failed.length} completed=${completed.length}`);

    return {
      waiting: waiting.length,
      active: active.length,
      delayed: delayed.length,
      failed: failed.length,
      completed: completed.length,
      waitingJobs: waiting.map((j) => ({ id: j.id, name: j.name, priority: j.opts.priority })),
      activeJobs: active.map((j) => ({ id: j.id, name: j.name, priority: j.opts.priority })),
    };
  } catch (err) {
    console.error('[QUEUE INSPECT] Error:', err);
    throw err;
  }
}
