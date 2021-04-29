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

  const a1 = await prisma.user.aggregate({
    cursor: {
      email: 'a@a.de',
    },
    orderBy: {
      age: 'asc',
    },
    skip: 12,
    take: 10,
    where: {
      age: { gt: 500 },
    },
    _count: true,
    _avg: {
      age: true,
      followerCount: true,
    },
    _max: {
      age: true,
      email: true,
      followerCount: true,
    },
    _min: {
      age: true,
      email: true,
      followerCount: true,
    },
    _sum: {
      age: true,
      followerCount: true,
    },
  })
  const c: number = a1._count
  type AvgSum = {
    age: number | null
    followerCount: number | null
  }
  const avg1: AvgSum = a1._avg
  const sum1: AvgSum = a1._sum

  type MinMax = {
    age: number | null
    email: string | null
    followerCount: number | null
  }
  const max1: MinMax = a1._max
  const min1: MinMax = a1._min

  const test2 = await prisma.user.aggregate({
    cursor: {
      email: 'a@a.de',
    },
    orderBy: {
      age: 'asc',
    },
    skip: 12,
    take: 10,
    where: {
      age: { gt: 500 },
    },
    _count: {
      _all: true,
      age: true,
      email: true,
      followerCount: true,
      id: true,
      name: true,
    },
  })
  const c2: {
    _all: number | null
    age: number | null
    email: number | null
    followerCount: number | null
    id: number | null
    name: number | null
  } = test2._count
}

main().catch((e) => {
  console.error(e)
})
