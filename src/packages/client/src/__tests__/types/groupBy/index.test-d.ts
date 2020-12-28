import { PrismaClient } from '.'
import { expectType, expectError } from 'tsd'

// tslint:disable

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:dev.db',
    },
  },
})

;(async () => {
  // by missing
  expectError(
    await prisma.user.groupBy({
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
    }),
  )

  // orderBy missing, required by skip & take
  expectError(
    await prisma.user.groupBy({
      by: ['name'],
      where: {
        age: {
          gt: -1,
        },
      },
      skip: 0,
      take: 10000,
    }),
  )

  // orderBy missing, required by skip
  expectError(
    await prisma.user.groupBy({
      by: ['name'],
      where: {
        age: {
          gt: -1,
        },
      },
      skip: 0,
    }),
  )

  // orderBy missing, required by take
  expectError(
    await prisma.user.groupBy({
      by: ['name'],
      where: {
        age: {
          gt: -1,
        },
      },
      take: 10000,
    }),
  )

  // age must by in by, as it's in orderBy - with take
  expectError(
    await prisma.user.groupBy({
      by: ['name'],
      orderBy: {
        age: 'desc',
      },
      where: {
        age: {
          gt: -1,
        },
      },
      take: 10000,
    }),
  )

  // age must by in by, as it's in orderBy
  expectError(
    await prisma.user.groupBy({
      by: ['name'],
      orderBy: {
        age: 'desc',
      },
      where: {
        age: {
          gt: -1,
        },
      },
    }),
  )

  // age must by in by, as it's in orderBy - minimal
  expectError(
    await prisma.user.groupBy({
      by: ['name'],
      orderBy: {
        age: 'desc',
      },
    }),
  )

  // age must by in by, as it's in orderBy - array
  expectError(
    await prisma.user.groupBy({
      by: [],
      orderBy: [
        {
          age: 'desc',
        },
      ],
    }),
  )
})()
