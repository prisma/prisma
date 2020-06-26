import { PrismaClient } from './@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  // const result = await prisma.user.create({
  //   data: {
  //     email: 'a@a.de',
  //     favoriteTree: 'ARBORVITAE',
  //     name: 'Say my name',
  //     permissions: 'ADMIN',
  //     status: 'A status',
  //     field: {
  //       this: {
  //         is: 'json',
  //       },
  //     },
  //   },
  // })

  const result = await prisma.user.findMany({
    where: {
      field: {
        not: {
          item: 'something',
        },
      },
    },
  })
  console.log(result)
  prisma.disconnect()
}

main().catch(console.error)
