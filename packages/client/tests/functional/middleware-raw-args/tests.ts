import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  ({ provider }) => {
    test('$queryRaw with template string', async () => {
      expect.assertions(1)
      const prisma = newPrismaClient()
      prisma.$use(({ args }, next) => {
        expect(args).toEqual([['SELECT ', ''], 1])

        return next(args)
      })

      await prisma.$queryRaw`SELECT ${1}`
    })

    test('$queryRaw with Prisma.sql instance', async () => {
      expect.assertions(1)
      const prisma = newPrismaClient()
      prisma.$use(({ args }, next) => {
        expect(args).toEqual([Prisma.sql`SELECT ${1}`])
        return next(args)
      })

      await prisma.$queryRaw(Prisma.sql`SELECT ${1}`)
    })

    // $executeRaw for sqlite is not allowed to return results
    testIf(provider !== 'sqlite')('$executeRaw with template string', async () => {
      expect.assertions(1)
      const prisma = newPrismaClient()
      prisma.$use(({ args }, next) => {
        expect(args).toEqual([['SELECT ', ''], 1])
        return next(args)
      })

      await prisma.$executeRaw`SELECT ${1}`
    })

    // $executeRaw for sqlite is not allowed to return results
    testIf(provider !== 'sqlite')('$executeRaw with Prisma.sql instance', async () => {
      expect.assertions(1)
      const prisma = newPrismaClient()
      prisma.$use(({ args }, next) => {
        expect(args).toEqual([Prisma.sql`SELECT ${1}`])
        return next(args)
      })

      await prisma.$executeRaw(Prisma.sql`SELECT ${1}`)
    })
  },

  {
    optOut: {
      from: ['mongodb'],
      reason: `test for SQL databases only`,
    },
    skipDefaultClientInstance: true,
  },
)
