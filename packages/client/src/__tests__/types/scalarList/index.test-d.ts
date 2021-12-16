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
    await prisma.forest.findMany({
      where: {
        trees: {
          hasSome: 'ash123',
        },
      },
    }),
  )
  expectError(
    await prisma.forest.findMany({
      where: {
        randomInts: {
          hasEvery: ['ash123'],
        },
      },
    }),
  )
})()
