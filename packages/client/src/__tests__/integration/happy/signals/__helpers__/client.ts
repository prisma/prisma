import { getTestClient } from '../../../../../utils/getTestClient'
import { EXIT_MESSAGE, READY_MESSAGE } from './constants'

async function main() {
  const PrismaClient = await getTestClient()
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
