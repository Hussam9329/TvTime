import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // In serverless environments (Vercel), the DB might not exist yet.
  // We try to create it on first cold start using prisma db push.
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL?.includes('/tmp/')) {
    try {
      execSync('npx prisma db push --skip-generate --accept-data-loss', {
        stdio: 'ignore',
        timeout: 30000,
      });
    } catch {
      // Ignore errors - DB might already exist
    }
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
