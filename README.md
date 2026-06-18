# Distributed Job Execution Platform

A production-inspired, reliable, and fault-tolerant distributed job execution system. Designed with Node.js, Next.js 15, PostgreSQL, Redis, BullMQ, and Socket.IO.

---

## Technical Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, Lucide-React
- **Backend API**: Node.js, Express, TypeScript, Zod, Socket.IO
- **Database Layer**: PostgreSQL, Prisma ORM
- **Scheduler & Queue**: Redis, BullMQ

---

## Platform Architecture

```mermaid
graph TD
    User([User / Web UI]) <--> |Socket.IO / HTTP| API[REST API Server / Express]
    API <--> |Prisma| DB[(PostgreSQL)]
    API ---> |Push Jobs| Queue[BullMQ / Redis]
    
    subgraph Cluster [Worker Nodes Cluster]
        Worker1[Worker Node 1]
        Worker2[Worker Node 2]
        WorkerN[Worker Node N]
    end
    
    Queue <--> |Pull Jobs & Heartbeats| Worker1
    Queue <--> |Pull Jobs & Heartbeats| Worker2
    Queue <--> |Pull Jobs & Heartbeats| WorkerN
    
    Worker1 <--> |Heartbeats & Status| API
    Worker2 <--> |Heartbeats & Status| API
    WorkerN <--> |Heartbeats & Status| API
    
    Monitor[Failure Detection & Requeuer Service] --> |Scan & Recover| DB
    Monitor --> |Re-queue| Queue
```

---

## Core Features
1. **Dynamic Prioritization**: Processes `HIGH` priority jobs first.
2. **Worker Nodes Register**: Workers register on boot and fetch a UUID.
3. **Heartbeat Sync**: Workers notify the coordinator every 5s.
4. **Active Failure Detection**: The crash detector checks for silent node drops (> 15s) and requeues interrupted jobs.
5. **Exponential Retries**: Automatically backs off retries up to 3 times (5s, 10s, 20s).
6. **Real-time Pipeline Broadcasting**: Leverages Socket.IO for real-time progress updates without polling.
7. **Control Operations**: Pause or resume the global queue at any time.

---

## Getting Started

### 1. Prerequisites
- Node.js (v18 or higher)
- PostgreSQL
- Redis Server

### 2. Environment Configurations
Create a `.env` file inside `/backend` directory:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/distributed_job_platform?schema=public"
REDIS_HOST="localhost"
REDIS_PORT=6379
```

And in `/frontend` directory, create a `.env.local` file:
```env
NEXT_PUBLIC_API_URL="http://localhost:5000"
```

### 3. Database Initialization
```bash
cd backend
npx prisma db push
npx prisma generate
```

### 4. Running the Project

#### Run REST API Server:
```bash
cd backend
npm run dev
```

#### Launch a Worker Node:
To spin up a worker node, open a new terminal:
```bash
cd backend
npm run worker
```
*(You can run this command in multiple terminals to spin up multiple concurrent worker nodes)*

#### Run Frontend Dashboard:
```bash
cd frontend
npm run dev
```

---

## Running Tests
Run the test suite using Jest:
```bash
cd backend
npm run test
```

---

## Architectural Tradeoffs
- **Polling vs Push Notifications**: Socket.IO was chosen over HTTP long-polling to minimize network overhead and provide real-time updates.
- **Database State vs Queue Status**: The PostgreSQL database remains the source of truth for audits and history, while Redis coordinates low-latency active queue states.
