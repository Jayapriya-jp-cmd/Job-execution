import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import apiRouter from './router';
import { startWorkerMonitor } from './monitor';

const app = express();
const server = http.createServer(app);

console.log(`[SERVER] Starting...`);
console.log(`[SERVER] PORT=${process.env.PORT || 5000}`);
console.log(`[SERVER] REDIS=${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
console.log(`[SERVER] DATABASE_URL configured: ${!!process.env.DATABASE_URL}`);

startWorkerMonitor();

export const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

app.use('/api', apiRouter);
app.use(apiRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
  });
});

const PORT = parseInt(process.env.PORT || '5000', 10);

server.listen(PORT, () => {
  console.log(`[SERVER] REST API Server running on port ${PORT}`);
});

export { server };
