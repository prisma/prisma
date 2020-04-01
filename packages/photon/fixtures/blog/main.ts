import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await Promise.all([
    prisma.user.findOne({
      where: {
        id: 'ck6cbrzhk0087izhug3dw21jl',
      },
    }),
    prisma.user.findOne({
      where: {
        id: 'ck6cbrzhp0089izhu1e3tb66r',
      },
    }),
  ])

  console.log(users)

  prisma.disconnect()
}

main().catch(e => {
  console.error(e)
})
