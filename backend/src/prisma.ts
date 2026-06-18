import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

const prismaClientSingleton = () => {
  console.log('[DATABASE] Creating new PrismaClient instance');
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

console.log('[DATABASE] PrismaClient ready');
