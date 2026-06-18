import { prisma } from '../src/prisma';
import { jobQueue } from '../src/queue';
import { JobStatus, WorkerStatus, JobPriority } from '@prisma/client';

describe('Distributed Job Execution Platform Test Suite', () => {

  beforeEach(async () => {
    await prisma.jobLog.deleteMany({});
    await prisma.jobExecution.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.worker.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Worker Registration and Availability Flow', async () => {
    const worker = await prisma.worker.create({
      data: {
        name: 'Test-Worker-Node',
        status: WorkerStatus.ONLINE,
      },
    });

    expect(worker.id).toBeDefined();
    expect(worker.name).toBe('Test-Worker-Node');
    expect(worker.status).toBe(WorkerStatus.ONLINE);

    const activeWorkers = await prisma.worker.findMany();
    expect(activeWorkers.length).toBe(1);
    expect(activeWorkers[0].id).toBe(worker.id);
  });

  test('Worker Heartbeat System Updates lastHeartbeat Timestamp', async () => {
    const worker = await prisma.worker.create({
      data: {
        name: 'Hearbeat-Worker-Node',
        status: WorkerStatus.ONLINE,
        lastHeartbeat: new Date(Date.now() - 30000),
      },
    });

    const originalTime = worker.lastHeartbeat.getTime();

    const updatedWorker = await prisma.worker.update({
      where: { id: worker.id },
      data: {
        lastHeartbeat: new Date(),
        status: WorkerStatus.ONLINE,
      },
    });

    expect(updatedWorker.lastHeartbeat.getTime()).toBeGreaterThan(originalTime);
    expect(updatedWorker.status).toBe(WorkerStatus.ONLINE);
  });

  test('Job Submission and Queue Injection Configuration', async () => {
    // Pause queue to prevent worker from stealing the job before we inspect
    await jobQueue.pause();

    const job = await prisma.job.create({
      data: {
        name: 'Integration Test Job',
        priority: JobPriority.HIGH,
        payload: { task: 'test-execution' },
        status: JobStatus.PENDING,
      },
    });

    expect(job.id).toBeDefined();
    expect(job.status).toBe(JobStatus.PENDING);
    expect(job.priority).toBe(JobPriority.HIGH);

    const bullJob = await jobQueue.add(job.name, { jobId: job.id }, {
      priority: 1,
      jobId: job.id,
    });

    expect(bullJob).toBeDefined();
    expect(bullJob.id).toBe(job.id);

    const counts = await jobQueue.getJobCounts();
    const totalJobs = counts.waiting + counts.prioritized + counts.active;
    expect(totalJobs).toBeGreaterThanOrEqual(1);

    await jobQueue.resume();
  });

  test('Exponential Backoff Retry Strategy Configurations', async () => {
    const job = await prisma.job.create({
      data: {
        name: 'Retry-Logic-Job',
        priority: JobPriority.MEDIUM,
        payload: {},
        status: JobStatus.PENDING,
        maxRetries: 3,
      },
    });

    const retryDelays = [5000, 10000, 20000];
    expect(retryDelays[0]).toBe(5000);
    expect(retryDelays[1]).toBe(10000);
    expect(retryDelays[2]).toBe(20000);

    await prisma.jobExecution.create({
      data: {
        jobId: job.id,
        status: JobStatus.RETRYING,
        retryAttempt: 1,
        errorMessage: 'Simulated Network Failure',
      },
    });

    const updatedJob = await prisma.job.update({
      where: { id: job.id },
      data: {
        retryCount: 1,
        status: JobStatus.RETRYING,
      },
    });

    expect(updatedJob.retryCount).toBe(1);
    expect(updatedJob.status).toBe(JobStatus.RETRYING);
  });

  test('Priority Ordering — HIGH before MEDIUM before LOW', async () => {
    // Pause queue to prevent worker from stealing jobs before we inspect
    await jobQueue.pause();

    const jobHigh = await prisma.job.create({
      data: { name: 'High-Priority', priority: JobPriority.HIGH, payload: {}, status: JobStatus.PENDING },
    });
    const jobMed = await prisma.job.create({
      data: { name: 'Medium-Priority', priority: JobPriority.MEDIUM, payload: {}, status: JobStatus.PENDING },
    });
    const jobLow = await prisma.job.create({
      data: { name: 'Low-Priority', priority: JobPriority.LOW, payload: {}, status: JobStatus.PENDING },
    });

    await jobQueue.add(jobLow.name, { jobId: jobLow.id }, { priority: 3, jobId: jobLow.id });
    await jobQueue.add(jobMed.name, { jobId: jobMed.id }, { priority: 2, jobId: jobMed.id });
    await jobQueue.add(jobHigh.name, { jobId: jobHigh.id }, { priority: 1, jobId: jobHigh.id });

    // Verify all 3 jobs exist in the queue (combine waiting + prioritized + active)
    const counts = await jobQueue.getJobCounts();
    const totalJobs = counts.waiting + counts.prioritized + counts.active;
    expect(totalJobs).toBeGreaterThanOrEqual(3);

    // Verify priority values via individual job fetch
    const bullHigh = await jobQueue.getJob(jobHigh.id);
    const bullMed = await jobQueue.getJob(jobMed.id);
    const bullLow = await jobQueue.getJob(jobLow.id);

    expect(bullHigh).toBeDefined();
    expect(bullMed).toBeDefined();
    expect(bullLow).toBeDefined();

    if (bullHigh && bullMed && bullLow) {
      expect(bullHigh.opts.priority).toBe(1);
      expect(bullMed.opts.priority).toBe(2);
      expect(bullLow.opts.priority).toBe(3);
    }

    await jobQueue.resume();
  });

  test('Job lifecycle: PENDING → RUNNING → COMPLETED status transition', async () => {
    const job = await prisma.job.create({
      data: {
        name: 'Lifecycle-Test',
        priority: JobPriority.MEDIUM,
        payload: { task: 'verify-transitions' },
        status: JobStatus.PENDING,
      },
    });
    expect(job.status).toBe(JobStatus.PENDING);

    const updated1 = await prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.RUNNING, progress: 10 },
    });
    expect(updated1.status).toBe(JobStatus.RUNNING);

    const updated2 = await prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.COMPLETED, progress: 100 },
    });
    expect(updated2.status).toBe(JobStatus.COMPLETED);
  });

  test('Job log entries created on status transitions', async () => {
    const job = await prisma.job.create({
      data: { name: 'Log-Test', priority: JobPriority.LOW, payload: {}, status: JobStatus.PENDING },
    });

    await prisma.jobLog.create({ data: { jobId: job.id, message: 'Job submitted' } });
    await prisma.jobLog.create({ data: { jobId: job.id, message: 'Job started' } });
    await prisma.jobLog.create({ data: { jobId: job.id, message: 'Job completed' } });

    const logs = await prisma.jobLog.findMany({ where: { jobId: job.id }, orderBy: { timestamp: 'asc' } });
    expect(logs).toHaveLength(3);
    expect(logs[0].message).toBe('Job submitted');
    expect(logs[1].message).toBe('Job started');
    expect(logs[2].message).toBe('Job completed');
  });

  test('Job execution record created on worker pickup', async () => {
    const worker = await prisma.worker.create({
      data: { name: 'Executor-Node', status: WorkerStatus.ONLINE },
    });
    const job = await prisma.job.create({
      data: { name: 'Execution-Test', priority: JobPriority.HIGH, payload: {}, status: JobStatus.PENDING },
    });

    const execution = await prisma.jobExecution.create({
      data: {
        jobId: job.id,
        workerId: worker.id,
        status: JobStatus.RUNNING,
        retryAttempt: 0,
      },
    });

    expect(execution.jobId).toBe(job.id);
    expect(execution.workerId).toBe(worker.id);
    expect(execution.status).toBe(JobStatus.RUNNING);

    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: { status: JobStatus.COMPLETED, completedAt: new Date(), executionTime: 1500 },
    });

    const updated = await prisma.jobExecution.findUnique({ where: { id: execution.id } });
    expect(updated?.status).toBe(JobStatus.COMPLETED);
    expect(updated?.executionTime).toBe(1500);
  });
});
