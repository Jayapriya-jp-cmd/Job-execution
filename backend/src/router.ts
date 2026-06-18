import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { jobQueue } from './queue';
import { JobPriority, JobStatus, WorkerStatus } from '@prisma/client';
import { io } from './index';

const router = Router();

const JobSubmitSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  priority: z.nativeEnum(JobPriority).default(JobPriority.MEDIUM),
  payload: z.record(z.any()).default({}),
});

const WorkerRegisterSchema = z.object({
  name: z.string().min(1, 'Worker name is required'),
});

const WorkerHeartbeatSchema = z.object({
  id: z.string().uuid('Invalid worker ID format'),
});

async function createJobLog(jobId: string, message: string) {
  await prisma.jobLog.create({
    data: { jobId, message },
  });
}

function emitJobUpdate(payload: Record<string, unknown>) {
  io.emit('job:update', payload);
}

// ──────────────────────────────────────────────
// JOB ROUTES
// ──────────────────────────────────────────────

router.post('/jobs', async (req: Request, res: Response) => {
  try {
    const validated = JobSubmitSchema.parse(req.body);
    console.log(`[API] POST /jobs name="${validated.name}" priority=${validated.priority}`);

    const job = await prisma.job.create({
      data: {
        name: validated.name,
        priority: validated.priority,
        payload: validated.payload,
        status: JobStatus.PENDING,
      },
    });
    console.log(`[DATABASE] Job created id=${job.id} status=PENDING`);

    await createJobLog(job.id, `Job submitted with priority ${validated.priority}`);

    let bullPriority = 3;
    if (validated.priority === JobPriority.HIGH) bullPriority = 1;
    if (validated.priority === JobPriority.MEDIUM) bullPriority = 2;

    console.log(`[QUEUE] Adding job ${job.id} to queue with priority=${bullPriority}`);

    const bullJob = await jobQueue.add(job.name, { jobId: job.id }, {
      priority: bullPriority,
      jobId: job.id,
    });

    console.log(`[QUEUE] Job added bullJobId=${bullJob.id} name=${bullJob.name}`);
    emitJobUpdate({
      id: job.id,
      name: job.name,
      priority: job.priority,
      status: job.status,
      progress: job.progress,
      retryCount: job.retryCount,
    });

    res.status(201).json({
      success: true,
      message: 'Job submitted successfully',
      job,
      bullId: bullJob.id,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error(`[API] POST /jobs validation error:`, error.errors);
      res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    } else {
      console.error(`[API] POST /jobs error:`, error.message || error);
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  }
});

router.get('/jobs', async (_req: Request, res: Response) => {
  try {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });
    res.json(jobs);
  } catch (error: any) {
    console.error(`[API] GET /jobs error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          include: { worker: true },
        },
        logs: { orderBy: { timestamp: 'asc' } },
      },
    });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json(job);
  } catch (error: any) {
    console.error(`[API] GET /jobs/${req.params.id} error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/jobs/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = await prisma.job.findUnique({ where: { id } });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
      return res.status(400).json({ success: false, error: 'Cannot cancel a completed or failed job' });
    }

    const qJob = await jobQueue.getJob(id);
    if (qJob) {
      await qJob.remove();
      console.log(`[QUEUE] Removed job ${id} from BullMQ queue`);
    }

    const updatedJob = await prisma.job.update({
      where: { id },
      data: { status: JobStatus.FAILED },
    });

    await createJobLog(id, 'Job execution cancelled by user');

    res.json({ success: true, message: 'Job execution cancelled', job: updatedJob });
  } catch (error: any) {
    console.error(`[API] POST /jobs/${req.params.id}/cancel error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ──────────────────────────────────────────────
// WORKER ROUTES
// ──────────────────────────────────────────────

router.post('/workers/register', async (req: Request, res: Response) => {
  try {
    console.log(`[API] POST /workers/register name="${req.body.name}"`);
    const validated = WorkerRegisterSchema.parse(req.body);
    const worker = await prisma.worker.create({
      data: {
        name: validated.name,
        status: WorkerStatus.ONLINE,
        lastHeartbeat: new Date(),
      },
    });
    console.log(`[DATABASE] Worker registered id=${worker.id} name=${worker.name}`);
    res.status(201).json({ success: true, worker });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error(`[API] Worker registration validation error:`, error.errors);
      res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    } else {
      console.error(`[API] Worker registration error:`, error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.get('/workers', async (_req: Request, res: Response) => {
  try {
    const workers = await prisma.worker.findMany({
      orderBy: { lastHeartbeat: 'desc' },
      include: {
        executions: {
          where: { status: JobStatus.RUNNING },
          include: { job: true },
        },
      },
    });
    res.json(workers);
  } catch (error: any) {
    console.error(`[API] GET /workers error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/workers/heartbeat', async (req: Request, res: Response) => {
  try {
    console.log(`[HEARTBEAT] Received for workerId=${req.body?.id}`);
    const validated = WorkerHeartbeatSchema.parse(req.body);

    const updated = await prisma.worker.update({
      where: { id: validated.id },
      data: {
        lastHeartbeat: new Date(),
        status: WorkerStatus.ONLINE,
      },
    });

    console.log(`[HEARTBEAT] Success worker="${updated.name}" id=${updated.id}`);
    res.json({ success: true, worker: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error(`[HEARTBEAT] Validation error for id="${req.body?.id}":`, error.errors);
      return res.status(400).json({ success: false, error: 'Invalid worker ID format' });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      console.error(`[HEARTBEAT] Worker not found in database: id="${req.body?.id}"`);
      return res.status(404).json({ success: false, error: 'Worker not found' });
    }

    console.error(`[HEARTBEAT] Unexpected error for id="${req.body?.id}":`, error.message || error);
    res.status(500).json({ success: false, error: 'Heartbeat update failed' });
  }
});

router.post('/jobs/:id/broadcast', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    emitJobUpdate({ id, ...req.body });
    console.log(`[SOCKET] job:update broadcast id=${id} payload=${JSON.stringify(req.body)}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error(`[SOCKET] Broadcast error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ──────────────────────────────────────────────
// QUEUE CONTROL ROUTES
// ──────────────────────────────────────────────

router.post('/queue/pause', async (_req: Request, res: Response) => {
  try {
    await jobQueue.pause();
    console.log(`[QUEUE] Paused`);
    res.json({ success: true, message: 'Queue paused' });
  } catch (error: any) {
    console.error(`[QUEUE] Pause error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/queue/resume', async (_req: Request, res: Response) => {
  try {
    await jobQueue.resume();
    console.log(`[QUEUE] Resumed`);
    res.json({ success: true, message: 'Queue resumed' });
  } catch (error: any) {
    console.error(`[QUEUE] Resume error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/debug/queue', async (_req: Request, res: Response) => {
  try {
    const { inspectQueueState } = await import('./queue');
    const state = await inspectQueueState();
    res.json({ success: true, state });
  } catch (error: any) {
    console.error(`[QUEUE] Debug inspect error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
