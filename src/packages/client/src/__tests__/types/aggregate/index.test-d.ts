import { PrismaClient } from '.'
import { expectError } from 'tsd'

// tslint:disable

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:dev.db',
    },
  },
})

;(async () => {
  expectError(
    await prisma.user.aggregate({
      cursor: {
        email: 'a@a.de',
      },
      orderBy: {
        age: 'asc',
      },
      skip: 12,
      take: 10,
      where: {
        age: { gt: 500, lt: '' },
      },
      count: true,
      avg: {
        age: true,
        followerCount: true,
      },
      max: {
        age: true,
        followerCount: true,
      },
      min: {
        age: true,
        followerCount: true,
      },
      sum: {
        age: true,
        followerCount: true,
      },
    }),
  )

  expectError(
    await prisma.user.aggregate({
      cursor: {
        email: 'a@a.de',
      },
      orderBy: {
        age: 'asc',
      },
      skip: 12,
      take: 10,
      where: {
        AND: [
          {
            age: { gt: 500, lt: '' },
          },
        ],
        OR: [
          {
            age: { gt: 500 },
          },
        ],
      },
      count: true,
      avg: {
        age: true,
        followerCount: true,
      },
      max: {
        age: true,
        followerCount: true,
      },
      min: {
        followerCount: true,
      },
      sum: {
        age: true,
        followerCount: true,
      },
      someField: {}, // TODO: fix types
      someRandomField: {}, // TODO: fix types
    }),
  )
  expectError(
    await prisma.user.aggregate({
      avg: { 
        email: true
      }
    }),
  )
  expectError(
    await prisma.user.aggregate({
      sum: { 
        email: true
      }
    }),
  )

  expectError(
    await prisma.user.aggregate({
      count: 0,
    }),
  )
  expectError(
    await prisma.user.aggregate({
      count: {
        _all: true
      },
    }),
  )
})()
