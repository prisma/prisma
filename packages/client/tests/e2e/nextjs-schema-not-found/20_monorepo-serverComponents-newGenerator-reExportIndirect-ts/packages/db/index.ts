import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.TEST_E2E_POSTGRES_URI! })
export const db = new PrismaClient({ adapter })
