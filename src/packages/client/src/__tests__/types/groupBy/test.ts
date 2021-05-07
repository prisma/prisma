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
    _avg: {
      age: true,
    },
    _count: {
      age: true,
      email: true,
      _all: true,
    },
    _max: {
      age: true,
    },
    _min: {
      age: true,
    },
    _sum: {
      age: true,
    },
    having: {
      name: '',
    },
  })
  const xLegacy = await prisma.user.groupBy({
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
    _avg: {
      age: number | null
    }
    _sum: {
      age: number | null
    }
    _count: {
      age: number | null
      email: number | null
      _all: number | null
    }
    _min: {
      age: number | null
    }
    _max: {
      age: number | null
    }
  }
  const x0: X0 = x[0]
  const xLegacy0: X0 = xLegacy[0]

  const y = await prisma.user.groupBy({
    by: ['name'],
    _count: true,
    having: {
      name: '',
      email: {
        _min: {
          contains: '',
        },
      },
    },
  })
  const yLegacy = await prisma.user.groupBy({
    by: ['name'],
    count: true,
    having: {
      name: '',
      email: {
        _min: {
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
                    _max: {
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
