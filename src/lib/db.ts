import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Always create a new client to ensure schema changes are picked up
// In production, we still use the global cache
const createPrismaClient = () => {
  return new PrismaClient({
    log: ['query'],
  })
}

// In development, we need to ensure we get a fresh client when schema changes
// Use a timestamp to force new instance
export const db = process.env.NODE_ENV === 'production' 
  ? (globalForPrisma.prisma ?? createPrismaClient())
  : createPrismaClient()

if (process.env.NODE_ENV === 'production') {
  globalForPrisma.prisma = db
}
