import { PrismaClient } from './@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  // const result = await prisma.users.create({
  //   data: {
  //     email: 'a@a.de',
  //     favoriteTree: 'ARBORVITAE',
  //     name: 'Say my name',
  //     permissions: 'ADMIN',
  //     status: 'A status',
  //   },
  // })

  const result = await prisma.user.findMany({
    where: {
      field: {
        // another: 'field',
      },
    },
  })
  console.log(result)
  prisma.disconnect()
}

main().catch(console.error)
