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
  const c: number = a1.count
  type AvgSum = {
    age: number
    followerCount: number | null
  }
  const avg1: AvgSum = a1.avg
  const sum1: AvgSum = a1.sum
 
  type MinMax = {
    age: number
    email: string | null
    followerCount: number | null
  }
  const max1: MinMax = a1.max
  const min1: MinMax = a1.min

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
    count: {
      $all: true,
      age: true,
      email: true,
      followerCount: true,
      id: true,
      name: true,
    },
  })
  const c2: {
    $all: number
    age: number
    email: number | null
    followerCount: number | null
    id: number | null
    name: number | null
  } = test2.count
}

main().catch((e) => {
  console.error(e)
})
