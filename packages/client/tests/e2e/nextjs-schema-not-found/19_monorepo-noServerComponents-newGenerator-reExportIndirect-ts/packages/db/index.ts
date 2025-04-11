import { PrismaClient } from './generated/client'

const db = new PrismaClient()

export { db }
