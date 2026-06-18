import { io } from 'socket.io-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const socket = io(BACKEND_URL, {
  autoConnect: true,
  transports: ['websocket'],
});
