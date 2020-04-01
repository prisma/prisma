import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.user.count({
    where: {
      name: 'Bob',
    },
  })

  console.log(count)

  prisma.disconnect()
}

main().catch(e => {
  console.error(e)
})
