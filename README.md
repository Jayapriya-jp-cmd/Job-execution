# Distributed Job Execution Platform

A production-inspired Distributed Job Execution Platform designed to process background tasks asynchronously using worker nodes, Redis queues, and real-time monitoring.

The system demonstrates distributed systems concepts such as queue-based processing, worker orchestration, heartbeat monitoring, fault tolerance, execution auditing, and horizontal scalability.

---

# Overview

In traditional applications, long-running tasks such as report generation, image processing, email delivery, or AI inference are often executed directly by the API server.

As traffic increases, this creates:

* Slow response times
* Resource contention
* Reduced scalability
* Poor user experience

This project solves the problem by decoupling job submission from job execution.

Users submit jobs through a web dashboard, jobs are stored in PostgreSQL, queued using BullMQ and Redis, and executed asynchronously by worker nodes.

---

# Technology Stack

## Frontend

* Next.js 15
* React
* TypeScript
* Tailwind CSS
* Socket.IO Client
* Lucide React

### Why Next.js?

* Modern React framework
* File-based routing
* Excellent developer experience
* Fast UI development

---

## Backend

* Node.js
* Express.js
* TypeScript
* Zod Validation
* Socket.IO

### Why Express?

* Lightweight
* Flexible
* Easy integration with BullMQ and Prisma

---

## Database

* PostgreSQL
* Prisma ORM

### Why PostgreSQL?

The project contains relational entities:

* Jobs
* Workers
* Executions
* Logs

PostgreSQL provides:

* ACID compliance
* Strong consistency
* Excellent relational support

### Why Prisma?

* Type-safe database operations
* Better developer productivity
* Simplified query management

---

## Queue & Scheduling

* Redis
* BullMQ

### Why Redis?

Redis is an in-memory datastore optimized for high-speed queue operations.

Benefits:

* Low latency
* High throughput
* Ideal for job scheduling

### Why BullMQ?

BullMQ provides:

* Job Queues
* Priority Scheduling
* Retry Mechanisms
* Delayed Jobs
* Queue Events

without requiring custom queue implementation.

---

# System Architecture

```text
User
 │
 ▼
Next.js Dashboard
 │
 ▼
Express API Server
 │
 ▼
BullMQ Queue
 │
 ▼
Redis
 │
 ▼
Worker Nodes
 │
 ▼
PostgreSQL
```

---

## Architecture Diagram

```mermaid
graph TD

User([User / Dashboard])

User --> API[Express API Server]

API --> DB[(PostgreSQL)]

API --> Queue[BullMQ Queue]

Queue --> Redis[(Redis)]

Redis --> Worker1[Worker Node 1]
Redis --> Worker2[Worker Node 2]
Redis --> WorkerN[Worker Node N]

Worker1 --> DB
Worker2 --> DB
WorkerN --> DB

Worker1 --> API
Worker2 --> API
WorkerN --> API

Monitor[Monitor Service]

Monitor --> DB
Monitor --> Queue

API <--> Socket[Socket.IO]

Socket <--> User
```

---

# Core Features

## Job Management

* Create Jobs
* View Jobs
* Track Progress
* Monitor Status

---

## Worker Registration

Workers automatically register when they start.

Each worker receives a unique identifier.

---

## Heartbeat Monitoring

Workers send heartbeat updates every 5 seconds.

Benefits:

* Worker health tracking
* Failure detection
* Monitoring support

---

## Priority Scheduling

Supported Priorities:

* HIGH
* MEDIUM
* LOW

Execution Order:

```text
HIGH
↓
MEDIUM
↓
LOW
```

---

## Retry Mechanism

Failed jobs can be retried automatically.

Benefits:

* Increased reliability
* Recovery from transient failures

---

## Real-Time Updates

Socket.IO provides:

* Live Job Progress
* Worker Status Updates
* Execution Notifications

without requiring page refreshes.

---

## Failure Detection

Monitor Service continuously checks worker heartbeats.

If a worker becomes unavailable:

* Worker marked OFFLINE
* Failure recorded
* Recovery actions triggered

---

# Database Design

## Job Table

Stores:

* Job Name
* Priority
* Status
* Progress
* Retry Count
* Creation Time

---

## Worker Table

Stores:

* Worker Name
* Worker Status
* Last Heartbeat

---

## JobExecution Table

Stores:

* Job Assignment
* Worker Assignment
* Start Time
* Completion Time
* Execution Result

---

## JobLog Table

Stores:

* Progress Messages
* Execution Logs
* Error Messages

---

# Job Lifecycle

## Step 1: Job Submission

User creates a job from the dashboard.

Example:

```text
Generate Monthly Report
Priority: HIGH
```

---

## Step 2: API Processing

API validates request.

Job is stored in PostgreSQL.

Initial Status:

```text
PENDING
```

---

## Step 3: Queue Insertion

BullMQ adds the job into Redis.

Queue State:

```text
Waiting
```

---

## Step 4: Worker Consumption

Available worker picks up the job.

Status changes:

```text
PENDING
↓
RUNNING
```

---

## Step 5: Progress Updates

Worker continuously updates progress.

Example:

```text
10%
30%
50%
70%
90%
```

---

## Step 6: Real-Time Broadcasting

Socket.IO broadcasts updates.

Dashboard updates instantly.

---

## Step 7: Completion

Worker completes execution.

Status becomes:

```text
COMPLETED
```

---

## Step 8: Auditing

Execution history and logs are stored permanently.

---

# Scalability Considerations

The system supports horizontal scaling.

Single Worker:

```text
Worker 1
```

Multiple Workers:

```text
Worker 1
Worker 2
Worker 3
Worker N
```

All workers consume jobs from the same Redis queue.

As workload increases, additional workers can be added without modifying application logic.

---

# Failure Handling Strategy

## Heartbeat Monitoring

Workers send heartbeats every 5 seconds.

Stored in:

```text
Worker.lastHeartbeat
```

---

## Worker Failure Detection

Monitor service checks heartbeat timestamps.

If heartbeat becomes stale:

```text
Worker Status = OFFLINE
```

---

## Job Recovery

Stalled jobs can be requeued for future processing.

---

## Retry Strategy

BullMQ supports retry policies.

Example:

```text
Attempt 1
↓
Attempt 2 (5 sec delay)
↓
Attempt 3 (10 sec delay)
↓
Attempt 4 (20 sec delay)
```

---

# Installation Guide

## Prerequisites

Install:

* Node.js v18+
* PostgreSQL
* Redis

---

# Clone Repository

```bash
git clone <repository-url>
cd project-root
```

---

# Backend Setup

```bash
cd backend
npm install
```

---

# Frontend Setup

```bash
cd frontend
npm install
```

---

# Environment Configuration

Create:

```text
backend/.env
```

```env
PORT=5000

DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/job_execution"

REDIS_HOST=localhost

REDIS_PORT=6379
```

If password contains special characters:

Example:

```env
DATABASE_URL="postgresql://postgres:password%40123@localhost:5432/job_execution"
```

---

# Database Initialization

Create PostgreSQL database:

```text
job_execution
```

Run:

```bash
cd backend

npx prisma generate

npx prisma db push
```

---

# Running the Application

## Start Backend API

```bash
cd backend

npm run dev
```

Expected:

```text
Server running on port 5000
```

---

## Start Worker

Open another terminal:

```bash
cd backend

npm run worker
```

Expected:

```text
Worker Registered
Heartbeat Started
Waiting For Jobs
```

---

## Start Frontend

Open another terminal:

```bash
cd frontend

npm run dev
```

Expected:

```text
http://localhost:3000
```

---

# Testing the System

## Create Job

Create:

```text
Job Name:
Generate Report

Priority:
HIGH
```

Expected Flow:

```text
PENDING
↓
RUNNING
↓
COMPLETED
```

---

## Verify Database

```sql
SELECT * FROM "Job";

SELECT * FROM "Worker";

SELECT * FROM "JobExecution";

SELECT * FROM "JobLog";
```

---

## Verify Redis

```bash
redis-cli

KEYS *
```

Verify BullMQ queue keys exist.

---

# Project Structure

```text
project-root
│
├── frontend
│   ├── src
│   ├── public
│   └── package.json
│
├── backend
│   ├── src
│   ├── prisma
│   ├── package.json
│   └── tsconfig.json
│
├── README.md
├── Architecture.md
└── Agent.md
```

---

# Challenges Faced

During development several challenges were encountered:

* Redis configuration issues
* BullMQ queue processing validation
* Worker bootstrap debugging
* Heartbeat monitoring validation
* PostgreSQL connection configuration
* End-to-end lifecycle verification
* Git repository structure issues

These challenges were resolved through systematic debugging, architecture validation, and end-to-end testing.

---

# Future Improvements

* Distributed worker deployment
* Kubernetes orchestration
* Advanced scheduling policies
* Metrics dashboard
* Log archival and compression
* Authentication and authorization
* Multi-tenant architecture

---

# Conclusion

The Distributed Job Execution Platform demonstrates modern distributed systems concepts including asynchronous processing, queue-based architectures, worker orchestration, heartbeat monitoring, failure recovery, execution auditing, and real-time monitoring.

The architecture follows patterns commonly used by large-scale production systems for reliable background task execution.
