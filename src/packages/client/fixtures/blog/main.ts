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
  // const result = await prisma.user.count({
  //   take: 10,
  // })
  // const result = await prisma.user.aggregate({
  //   avg: {
  //     age: true
  //   },
  //   max: {
  //     age: true
  //   },
  //   sum: {
  //     age: true
  //   },
  //   min: {
  //     age:  true
  //   },
  //   count: true
  // })
  // result.count
  // result.avg.age
  // console.log(result)
  const res = await prisma.user.findMany({
    distinct: ['age'],
  })
  console.log(res)
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
