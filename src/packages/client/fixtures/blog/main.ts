import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  errorFormat: 'pretty',
})

async function main() {
  // const result = await prisma.user.aggregate({
  //   avg: {
  //     age3: true,
  //   },
  //   sum: {
  //     age: true,
  //   },
  //   min: {
  //     age: true,
  //   },
  //   max: {
  //     age: true,
  //   },
  //   count: true,
  // })
  const result = await prisma.user.count({
    take: 10,
  })
  console.log(result)
  prisma.disconnect()
}

async function seed() {
  for (let i = 0; i < 10; i++) {
    await prisma.user.create({
      data: {
        email: `a${i}@asd.de`,
        age: 29,
        name: 'Bob',
      },
    })
  }
}

main().catch((e) => {
  console.error(e)
})
