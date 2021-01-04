import { Prisma, PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
})

async function main() {
  prisma.$on('query', (q) => {
    console.log({ q })
  })

  // await prisma.user.create({
  //   data: {
  //     email: 'a2@a.de',
  //     age: 9,
  //     name: 'bob',
  //   },
  // })

  const res = await prisma.user.groupBy({
    by: ['age', 'email'],
    avg: {
      age: true,
    },
    having: {
      AND: [
        {
          NOT: [
            {
              name: {
                contains: '',
              },
              age: {
                sum: {
                  gt: 1,
                },
              },
            },
          ],
        },
        {
          name: '',
        },
      ],
      age: {
        gt: 1,
        avg: {
          gt: 5,
        },
        not: {
          not,
        },
      },
    },
  })

  type A = [1, 2, 3]
  type B = {
    a: 1
  }
  type C = 1
  type D = ''

  type IsObject<T extends any> = T extends Array<any>
    ? 0
    : T extends object
    ? 1
    : 0

  type Ya = IsObject<D>

  // res.AND.NOT.

  console.log(res)

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
