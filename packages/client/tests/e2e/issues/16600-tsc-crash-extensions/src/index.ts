import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// this has caused tsc to crash with recursion limit exceeded for union comparison
export const prisma = globalForPrisma.prisma || new PrismaClient({ log: ['query'] })

// this has caused tsc to crash with type node type serialization limit exceeded
export const prismaClient = new PrismaClient().$extends({})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
