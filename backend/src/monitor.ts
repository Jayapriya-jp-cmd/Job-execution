import dotenv from 'dotenv';
dotenv.config();

import { prisma } from './prisma';
import { jobQueue } from './queue';
import { JobStatus, WorkerStatus } from '@prisma/client';
import { io } from './index';

const OFFLINE_THRESHOLD_MS = 15000;
const MONITOR_INTERVAL_MS = 10000;

function broadcast(event: string, data: any) {
  try {
    io.emit(event, data);
  } catch {
    /* monitor runs in API process; safe to suppress */
  }
}

function priorityToBullmq(p: string): number {
  if (p === 'HIGH') return 1;
  if (p === 'MEDIUM') return 2;
  return 3;
}

export async function detectWorkerFailures() {
  try {
    const workerCount = await prisma.worker.count();
    if (workerCount === 0) {
      return;
    }

    const staleCutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

    const deadWorkers = await prisma.worker.findMany({
      where: {
        status: WorkerStatus.ONLINE,
        lastHeartbeat: { lt: staleCutoff },
      },
      include: {
        executions: {
          where: { status: JobStatus.RUNNING },
        },
      },
    });

    if (deadWorkers.length === 0) {
      return;
    }

    console.log(`[MONITOR] Found ${deadWorkers.length} stale worker(s) — recovering...`);

    for (const worker of deadWorkers) {
      console.log(`[MONITOR] Marking worker "${worker.name}" (${worker.id}) OFFLINE`);

      await prisma.worker.update({
        where: { id: worker.id },
        data: { status: WorkerStatus.OFFLINE },
      });

      for (const execution of worker.executions) {
        console.log(`[MONITOR] Recovering execution ${execution.id} job=${execution.jobId}`);

        await prisma.jobExecution.update({
          where: { id: execution.id },
          data: {
            status: JobStatus.FAILED,
            completedAt: new Date(),
            errorMessage: 'Worker heartbeat timeout — marked offline by monitor',
          },
        });

        const job = await prisma.job.findUnique({ where: { id: execution.jobId } });
        if (!job) {
          console.log(`[MONITOR] Job ${execution.jobId} not found, skipping`);
          continue;
        }

        if (job.retryCount < job.maxRetries) {
          const nextAttempt = job.retryCount + 1;

          await prisma.job.update({
            where: { id: job.id },
            data: { status: JobStatus.RETRYING, retryCount: nextAttempt },
          });

          await prisma.jobLog.create({
            data: {
              jobId: job.id,
              message: `Recovered from offline worker "${worker.name}" — attempt ${nextAttempt}/${job.maxRetries}`,
            },
          });

          await jobQueue.add(job.name, { jobId: job.id }, {
            priority: priorityToBullmq(job.priority),
            jobId: job.id,
            attempts: job.maxRetries,
            backoff: { type: 'exponential', delay: 5000 },
          });

          broadcast('job:update', {
            id: job.id,
            status: JobStatus.RETRYING,
            message: `Re-queued after worker "${worker.name}" crash`,
          });

          console.log(`[MONITOR] Re-queued job ${job.id} (attempt ${nextAttempt})`);
        } else {
          await prisma.job.update({
            where: { id: job.id },
            data: { status: JobStatus.FAILED },
          });

          await prisma.jobLog.create({
            data: {
              jobId: job.id,
              message: `Max retries (${job.maxRetries}) exceeded after worker "${worker.name}" crash`,
            },
          });

          broadcast('job:update', {
            id: job.id,
            status: JobStatus.FAILED,
            message: `Failed permanently after worker crash`,
          });

          console.log(`[MONITOR] Job ${job.id} failed permanently — retries exhausted`);
        }
      }
    }
  } catch (error: any) {
    console.error(`[MONITOR] Scan error:`, error.message);
  }
}

export function startWorkerMonitor() {
  console.log(`[MONITOR] Daemon started — checking every ${MONITOR_INTERVAL_MS / 1000}s`);
  setInterval(detectWorkerFailures, MONITOR_INTERVAL_MS);
}

if (require.main === module) {
  startWorkerMonitor();
}

export default startWorkerMonitor;
