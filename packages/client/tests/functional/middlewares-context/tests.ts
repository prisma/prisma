import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore
declare let PrismaClient: typeof import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(() => {
  let isolatedPrisma: typeof prisma

  beforeEach(() => {
    isolatedPrisma = new PrismaClient()
  })

  afterEach(async () => {
    await isolatedPrisma.$disconnect()
  })

  test('context should not be defined', async () => {
    const args = {
      where: {
        email: faker.internet.email(),
      },
    }

    isolatedPrisma.$use((params, next) => {
      expect(params.args).toBe(args)
      expect(params.context).toBe(undefined)
      return next(params)
    })

    await isolatedPrisma.user.findMany(args)
  })

  test('context should be defined', async () => {
    const context = {
      cache: {
        maxAge: 500,
      },
    }
    const where = {
      email: faker.internet.email(),
    }

    isolatedPrisma.$use((params, next) => {
      expect(params.args.where).toBe(where)
      expect(params.context).toBe(context)

      return next(params)
    })

    await isolatedPrisma.user.findMany({
      where,
      context,
    })
  })

  test('context should be defined any middleware', async () => {
    const context = {
      cache: {
        maxAge: 500,
      },
    }
    isolatedPrisma.$use((params, next) => {
      expect(params.context).toBe(context)
      return next(params)
    })
    isolatedPrisma.$use((params, next) => {
      expect(params.context).toBe(context)
      return next(params)
    })

    await isolatedPrisma.user.findMany({
      context,
    })
  })
})
