import { PrismaClient } from './@prisma/client'

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
              email: '',
              name: {
                min: {},
              },
              age: {
                sum: {
                  gt: 1,
                },
              },
            },
          ],
        },
      ],
      age: {
        gt: 1,
        avg: {
          gt: 5,
        },
      },
    },
  })

  console.log(res)

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
