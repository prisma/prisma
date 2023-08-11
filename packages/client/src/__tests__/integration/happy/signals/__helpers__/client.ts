import { PrismaClient } from '../node_modules/@prisma/client'
import { EXIT_MESSAGE, READY_MESSAGE } from './constants'

const prisma = new PrismaClient()

console.log(READY_MESSAGE)

setTimeout(() => {
  void prisma.$disconnect()
  console.log(EXIT_MESSAGE)
  process.exit(0)
}, 1000)
