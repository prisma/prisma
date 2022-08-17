import { generateTestClient } from '../../../../../utils/getTestClient'
import { EXIT_MESSAGE, READY_MESSAGE } from './constants'

async function main() {
  await generateTestClient()
  const { PrismaClient } = require('./node_modules/@prisma/client')
  const prisma = new PrismaClient()

  console.log(READY_MESSAGE)

  setTimeout(() => {
    prisma.$disconnect()
    console.log(EXIT_MESSAGE)
    process.exit(0)
  }, 1000)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
