import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findOne({
    where: {
      id: 'ck6cbrzhk0087izhug3dw21jl',
    },
  })

  console.log(users)

  process.exit()
  // prisma.disconnect()
}

main().catch(e => {
  console.error(e)
})
