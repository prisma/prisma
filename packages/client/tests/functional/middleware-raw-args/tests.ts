import { Providers } from '../_utils/providers'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './generated/prisma/client'

declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>
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
    testIf(provider !== Providers.SQLITE)('$executeRaw with template string', async () => {
      expect.assertions(1)
      const prisma = newPrismaClient()
      prisma.$use(({ args }, next) => {
        expect(args).toEqual([['SELECT ', ''], 1])
        return next(args)
      })

      await prisma.$executeRaw`SELECT ${1}`
    })

    // $executeRaw for sqlite is not allowed to return results
    testIf(provider !== Providers.SQLITE)('$executeRaw with template string', async () => {
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
      from: [Providers.MONGODB],
      reason: `test for SQL databases only`,
    },
    skipDriverAdapter: {
      from: ['js_pg_cockroachdb'],
      reason: 'Code: `42P18`. Message: `ERROR: could not determine data type of placeholder $1',
    },
    skipDefaultClientInstance: true,
  },
)
