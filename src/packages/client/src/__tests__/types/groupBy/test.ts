import { PrismaClient } from '@prisma/client'

// tslint:disable

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file:dev.db',
      },
    },
  })

  const x = await prisma.user.groupBy({
    by: ['name'],
    where: {
      age: {
        gt: -1,
      },
    },
    orderBy: [
      {
        name: 'desc',
      },
    ],
    skip: 0,
    take: 10000,
    avg: {
      age: true,
    },
    count: {
      age: true,
      email: true,
      _all: true,
    },
    max: {
      age: true,
    },
    min: {
      age: true,
    },
    sum: {
      age: true,
    },
    having: {
      name: '',
    },
  })

  type X0 = {
    name: string | null
    avg: {
      age: number
    }
    sum: {
      age: number
    }
    count: {
      age: number
      email: number | null
      _all: number
    }
    min: {
      age: number
    }
    max: {
      age: number
    }
  }
  const x0: X0 = x[0]

  const y = await prisma.user.groupBy({
    by: ['name'],
    count: true,
    having: {
      name: '',
      email: {
        min: {
          contains: '',
        },
      },
    },
  })

  const z = await prisma.user.groupBy({
    by: ['name'],
    having: {
      OR: [
        {
          AND: [
            {
              NOT: [
                {
                  email: {
                    max: {
                      contains: '',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  })
}

main().catch((e) => {
  console.error(e)
})
