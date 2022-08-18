import { EXIT_MESSAGE, READY_MESSAGE } from './constants'

const { PrismaClient } = require('../node_modules/@prisma/client')

const prisma = new PrismaClient()

console.log(READY_MESSAGE)

setTimeout(() => {
  prisma.$disconnect()
  console.log(EXIT_MESSAGE)
  process.exit(0)
}, 1000)
