import dotenv from 'dotenv';
dotenv.config();

import { Worker as BullWorker, Job as BullJob } from 'bullmq';
import axios from 'axios';
import { prisma } from './prisma';
import { connection, JOB_QUEUE_NAME, jobQueue } from './queue';
import { JobStatus, WorkerStatus } from '@prisma/client';

const PORT = process.env.PORT || '5000';
function resolveApiUrl() {
  const configured = process.env.API_URL?.trim();
  const base = (configured && configured.length > 0 ? configured : `http://localhost:${PORT}`).replace(/\/+$/, '');

  if (base.endsWith('/api')) {
    return base;
  }

  return `${base}/api`;
}

const API_URL = resolveApiUrl();

let workerId: string | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let activeWorkerName = process.env.WORKER_NAME || `Worker-${Math.floor(1000 + Math.random() * 9000)}`;

console.log(`[WORKER] ========================================`);
console.log(`[WORKER] Worker process starting`);
console.log(`[WORKER] PID=${process.pid}`);
console.log(`[WORKER] Name=${activeWorkerName}`);
console.log(`[WORKER] API_URL=${API_URL}`);
console.log(`[WORKER] API_URL env=${process.env.API_URL || '<unset>'}`);
console.log(`[WORKER] Queue="${JOB_QUEUE_NAME}"`);
console.log(`[WORKER] require.main === module: ${require.main === module}`);
console.log(`[WORKER] argv[1]=${process.argv[1]}`);

// ── logJobAction: update DB status + create log + throw on failure ──
async function logJobAction(jobId: string, message: string, status: JobStatus, progress?: number) {
  console.log(`[WORKER] logJobAction: job=${jobId} status=${status} progress=${progress}`);

  await prisma.jobLog.create({ data: { jobId, message } });
  console.log(`[DATABASE] JobLog created for job=${jobId}`);

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: {
      status,
      ...(progress !== undefined ? { progress } : {}),
    },
  });

  console.log(`[DATABASE] Job ${jobId} status → ${status} progress=${updated.progress}`);

  try {
    await axios.post(`${API_URL}/jobs/${jobId}/broadcast`, {
      status,
      progress: updated.progress,
      retryCount: updated.retryCount,
      message,
    });
  } catch (error: any) {
    console.error(`[SOCKET] Broadcast failed for job=${jobId}:`, error.response?.data?.error || error.message);
  }
}

// ── Heartbeat Loop ──
function startHeartbeat() {
  if (!workerId) {
    console.log(`[HEARTBEAT] Cannot start: workerId is null`);
    return;
  }

  console.log(`[HEARTBEAT] Starting every 5s → ${API_URL}/workers/heartbeat`);

  heartbeatInterval = setInterval(async () => {
    try {
      const res = await axios.post(`${API_URL}/workers/heartbeat`, { id: workerId });
      console.log(`[HEARTBEAT] Success workerId=${workerId} status=${res.status}`);
    } catch (error: any) {
      const detail = error.response?.data?.error || error.message;
      console.error(`[HEARTBEAT] Failed workerId=${workerId}: ${detail}`);
    }
  }, 5000);
}

// ── Graceful Shutdown ──
async function shutdown() {
  console.log(`[WORKER] Shutting down...`);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (workerId) {
    try {
      await prisma.worker.update({
        where: { id: workerId },
        data: { status: WorkerStatus.OFFLINE },
      });
      console.log(`[WORKER] Marked OFFLINE in database`);
    } catch (e) {
      console.error(`[WORKER] Failed to mark OFFLINE:`, (e as Error).message);
    }
  }
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ── Main Bootstrap ──
async function bootstrap() {
  try {
    // ---------- Step 1: Register with API ----------
    console.log(`[WORKER] Registering as "${activeWorkerName}"...`);
    const regRes = await axios.post(`${API_URL}/workers/register`, { name: activeWorkerName });

    if (!regRes.data?.worker?.id) {
      throw new Error(`Registration response missing worker.id: ${JSON.stringify(regRes.data)}`);
    }

    workerId = regRes.data.worker.id;
    console.log(`[WORKER] Registered id=${workerId}`);

    // ---------- Step 2: Start Heartbeats ----------
    startHeartbeat();

    // ---------- Step 3: Ping queue to verify Redis ----------
    try {
      const queueJobCounts = await jobQueue.getJobCounts();
      console.log(`[WORKER] BullMQ queue "${JOB_QUEUE_NAME}" accessible. Counts:`, queueJobCounts);
    } catch (redisErr) {
      console.error(`[WORKER] Cannot access BullMQ queue — Redis may be unreachable:`, (redisErr as Error).message);
      throw redisErr;
    }

    // ---------- Step 4: Create BullMQ Worker ----------
    console.log(`[WORKER] Creating BullMQ Worker on "${JOB_QUEUE_NAME}"...`);

    const worker = new BullWorker(
      JOB_QUEUE_NAME,
      async (bullJob: BullJob) => {
        const { jobId } = bullJob.data;
        console.log(`[WORKER] JOB RECEIVED bullJobId=${bullJob.id} name=${bullJob.name} data=${JSON.stringify(bullJob.data)}`);

        if (!jobId) {
          console.warn(`[WORKER] JOB SKIPPED — no jobId in payload`);
          return;
        }

        const localWorkerId = workerId || undefined;
        console.log(`[WORKER] JOB PROCESSING job=${jobId} worker=${activeWorkerName}`);

        // Verify job exists in DB before processing
        const dbJob = await prisma.job.findUnique({ where: { id: jobId } });
        if (!dbJob) {
          console.warn(`[WORKER] Job ${jobId} not found in DB — skipping`);
          return;
        }

        // Create execution record
        const execution = await prisma.jobExecution.create({
          data: {
            jobId,
            workerId: localWorkerId,
            status: JobStatus.RUNNING,
            retryAttempt: bullJob.attemptsMade,
          },
        });
        console.log(`[DATABASE] JobExecution created id=${execution.id}`);

        // Update job status → RUNNING at 10%
        await logJobAction(jobId, `Job started on worker: ${activeWorkerName}`, JobStatus.RUNNING, 10);
        console.log(`[WORKER] Progress 10%`);

        // Simulate work in steps
        const totalSteps = 4;
        const startTime = Date.now();

        for (let step = 1; step <= totalSteps; step++) {
          await new Promise((r) => setTimeout(r, 1500));

          const pct = Math.min(10 + step * 20, 90);
          await logJobAction(jobId, `Step ${step}/${totalSteps}`, JobStatus.RUNNING, pct);
          console.log(`[WORKER] Progress ${pct}% — step ${step}/${totalSteps}`);
        }

        // Check for simulated failure
        const target = await prisma.job.findUnique({ where: { id: jobId } });
        if (target?.payload && (target.payload as any).simulateFailure === true) {
          console.log(`[WORKER] Simulated failure for job ${jobId}`);
          throw new Error('Simulated payload task failure');
        }

        const execTimeMs = Date.now() - startTime;

        // Mark execution COMPLETED
        await prisma.jobExecution.update({
          where: { id: execution.id },
          data: {
            status: JobStatus.COMPLETED,
            completedAt: new Date(),
            executionTime: execTimeMs,
          },
        });
        console.log(`[DATABASE] JobExecution ${execution.id} → COMPLETED`);

        // Update job → COMPLETED at 100%
        await logJobAction(jobId, `Job completed by ${activeWorkerName}`, JobStatus.COMPLETED, 100);
        console.log(`[WORKER] JOB COMPLETED job=${jobId} time=${execTimeMs}ms`);
      },
      {
        connection,
        concurrency: 1,
      },
    );

    worker.on('active', (job) => {
      console.log(`[WORKER EVENT] active id=${job.id} name=${job.name}`);
    });

    worker.on('completed', (job) => {
      console.log(`[WORKER EVENT] completed id=${job.id} name=${job.name}`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[WORKER EVENT] failed id=${job?.id} name=${job?.name} error=${err?.message}`);
    });

    worker.on('error', (err) => {
      console.error(`[WORKER EVENT] error: ${err.message || err}`);
    });

    // ── Dedicated failure handler (DB cleanup + retry logic) ──
    worker.on('failed', async (bullJob: BullJob | undefined, error: Error) => {
      if (!bullJob) return;
      const { jobId } = bullJob.data;
      if (!jobId) return;

      const attemptsMade = bullJob.attemptsMade;
      const maxRetries = bullJob.opts.attempts || 3;

      console.log(`[WORKER FAIL] job=${jobId} attempt=${attemptsMade}/${maxRetries} error="${error.message}"`);

      try {
        // Update last execution
        const lastExec = await prisma.jobExecution.findFirst({
          where: { jobId, workerId: workerId || undefined },
          orderBy: { startedAt: 'desc' },
        });

        if (lastExec) {
          await prisma.jobExecution.update({
            where: { id: lastExec.id },
            data: {
              status: attemptsMade < maxRetries ? JobStatus.RETRYING : JobStatus.FAILED,
              completedAt: new Date(),
              errorMessage: error.message,
            },
          });
        }

        if (attemptsMade < maxRetries) {
          await prisma.job.update({
            where: { id: jobId },
            data: { retryCount: attemptsMade },
          });
          await logJobAction(
            jobId,
            `Attempt ${attemptsMade} failed. Retrying... ${error.message}`,
            JobStatus.RETRYING,
          );
          console.warn(`[WORKER] Job ${jobId} will retry (attempt ${attemptsMade})`);
        } else {
          await logJobAction(
            jobId,
            `Job failed permanently after ${attemptsMade} attempts. ${error.message}`,
            JobStatus.FAILED,
          );
          console.error(`[WORKER] Job ${jobId} failed permanently`);
        }
      } catch (dbErr: any) {
        console.error(`[WORKER FAIL] DB error in failure handler for job=${jobId}: ${dbErr.message}`);
      }
    });

    console.log(`[WORKER] WORKER STARTED — listening on queue "${JOB_QUEUE_NAME}"`);
  } catch (err: any) {
    console.error(`[WORKER] FATAL bootstrap error:`, err.message);
    console.error(err.stack);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

// ── Bootstrap decision ──
const isMainProcess =
  require.main === module ||
  process.argv[1]?.replace(/\\/g, '/').endsWith('worker.ts') ||
  process.argv[1]?.replace(/\\/g, '/').endsWith('worker.js');

console.log(`[WORKER] isMainProcess=${isMainProcess} filename=${module.filename}`);

if (isMainProcess) {
  bootstrap().catch((err) => {
    console.error(`[WORKER] Unhandled bootstrap rejection:`, err);
    process.exit(1);
  });
}

export { bootstrap };
