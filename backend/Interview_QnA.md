# Distributed Systems Technical Interview Q&A

This guide covers core distributed systems questions related to the architecture of our **Distributed Job Execution Platform**.

---

### Q1: Why do priority queues improve system throughput compared to standard FIFO queues?
**A**: While priority queues do not increase the raw capacity of the worker nodes, they significantly improve **business throughput** by prioritizing high-impact tasks (e.g., checkout transactions or live video rendering) over background processing tasks (e.g., report generation). 

In a standard FIFO queue, a sudden influx of low-priority tasks can block high-priority tasks, leading to poor user experiences. Priority queues ensure that CPU and memory resources are allocated to the most critical workloads first.

---

### Q2: How does the platform handle worker node failure? Explain the crash detection and recovery workflow.
**A**: Worker nodes send a heartbeat request to the REST API every 5 seconds, updating their `lastHeartbeat` timestamp in PostgreSQL. 

A failure detection daemon (Monitor) runs every 10 seconds:
1. It queries the database for workers marked `ONLINE` whose `lastHeartbeat` is older than 15 seconds.
2. It marks those workers as `OFFLINE`.
3. It finds any jobs marked `RUNNING` that were assigned to the offline workers.
4. For each active job, it checks the current retry count:
   - If the job has retries remaining, its status is changed to `RETRYING`, and it is re-added to the BullMQ queue.
   - If it has exceeded the maximum retries (3), it is marked as `FAILED`.

---

### Q3: What is "Split-Brain" in worker nodes, and how does this platform prevent duplicate job execution?
**A**: "Split-brain" occurs when a worker node is still running but becomes disconnected from the network. Because the coordinator stops receiving heartbeats, it assumes the worker has crashed, marks it offline, and reschedules its active jobs to another worker. If the original worker regains connectivity, both workers could end up executing the same job, leading to duplicate writes.

**Mitigation strategies**:
- **Atomic Locks / Claims**: Workers should acquire an atomic lease in Redis (using a command like `SET NX PX`) before executing a job.
- **Idempotency**: Jobs should be designed to be idempotent. If a job is executed multiple times, the final state of the system should remain the same.
- **Database Optimistic Locking**: Use a version field on the database record. When updating the job's state, check that the version matches. If the version has changed (indicating another worker updated it), abort the execution.

---

### Q4: How does BullMQ prevent two workers from consuming the same job simultaneously?
**A**: BullMQ uses Redis's atomic operations and Lua scripting. When a worker requests a job, BullMQ runs a Lua script that:
1. Moves the job from the `waiting` list to the `active` list.
2. Assigns a lock to the job for a specific duration (lock visibility timeout).
3. Associates the lock with the unique ID of the requesting worker.

Because Redis executes commands sequentially in a single thread, only one worker can successfully claim the lock and move the job to the active state.

---

### Q5: How would you scale this platform to support 10,000+ jobs per second?
**A**: 
1. **Redis Clustering & Sentinel**: Shard Redis keys across multiple nodes to distribute the memory and network load.
2. **Horizontal Worker Scaling**: Deploy workers as stateless containers (e.g., Kubernetes Pods) that scale automatically based on queue length or CPU utilization.
3. **Database Performance**:
   - Implement read/write splitting, routing read queries to read replicas.
   - Set up table partitioning on the `JobLogs` and `JobExecution` tables by date.
   - Use index tuning for queries on job status and worker heartbeats.
4. **Connection Pooling**: Use connection pools (like `pgBouncer` for PostgreSQL) to manage database connections efficiently across many concurrent worker processes.
