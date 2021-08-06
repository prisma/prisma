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

  const a1Legacy = await prisma.user.aggregate({
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
    count: true,
    avg: {
      age: true,
      followerCount: true,
    },
    max: {
      age: true,
      email: true,
      followerCount: true,
    },
    min: {
      age: true,
      email: true,
      followerCount: true,
    },
    sum: {
      age: true,
      followerCount: true,
    },
  })
  const cLegacy: number = a1Legacy.count
  const avg1Legacy: AvgSum = a1Legacy.avg
  const sum1Legacy: AvgSum = a1Legacy.sum
  const max1Legacy: MinMax = a1Legacy.max
  const min1Legacy: MinMax = a1Legacy.min

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
  type Count = {
    _all: number | null
    age: number | null
    email: number | null
    followerCount: number | null
    id: number | null
    name: number | null
  }
  const c2: Count = test2._count

  const test2Legacy = await prisma.user.aggregate({
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
    count: {
      _all: true,
      age: true,
      email: true,
      followerCount: true,
      id: true,
      name: true,
    },
  })
  const c2Legacy: Count = test2Legacy.count
}

main().catch((e) => {
  console.error(e)
})
