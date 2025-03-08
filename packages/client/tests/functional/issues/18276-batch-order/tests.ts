import { Providers } from '../../_utils/providers'
import { waitFor } from '../../_utils/tests/waitFor'
import type { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ provider }) => {
    const isSqlServer = provider === Providers.SQLSERVER

    test('executes batch queries in the right order when using extensions + middleware', async () => {
      const prisma = newPrismaClient({
        log: [{ emit: 'event', level: 'query' }],
      }) as PrismaClient<{ log: [{ level: 'query'; emit: 'event' }] }>

      const queries: string[] = []

      prisma.$on('query', ({ query }) => queries.push(query))

      prisma.$use(async (params, next) => {
        await Promise.resolve()
        return next(params)
      })

      const xprisma = prisma.$extends({
        query: {
          async $queryRawUnsafe({ args, query }) {
            const [, result] = await prisma.$transaction([
              prisma.$queryRawUnsafe('SELECT 1'),
              query(args),
              prisma.$queryRawUnsafe('SELECT 3'),
            ])
            return result
          },
        },
      })

      await xprisma.$queryRawUnsafe('SELECT 2')

      const expectation = [
        expect.stringContaining('BEGIN'),
        'SELECT 1',
        'SELECT 2',
        'SELECT 3',
        expect.stringContaining('COMMIT'),
      ]
      if (isSqlServer) {
        expectation.unshift(expect.stringContaining('SET TRANSACTION'))
      }

      await waitFor(() => expect(queries).toEqual(expectation))
    })

    test('executes batch in right order when using delayed middleware', async () => {
      const prisma = newPrismaClient({
        log: [{ emit: 'event', level: 'query' }],
      }) as PrismaClient<{ log: [{ level: 'query'; emit: 'event' }] }>

      const queries: string[] = []

      prisma.$on('query', ({ query }) => queries.push(query))

      prisma.$use(async (params, next) => {
        await new Promise((r) => setTimeout(r, Math.random() * 1_000))
        return next(params)
      })

      await prisma.$transaction([
        prisma.$queryRawUnsafe('SELECT 1'),
        prisma.$queryRawUnsafe('SELECT 2'),
        prisma.$queryRawUnsafe('SELECT 3'),
      ])

      const expectation = [
        expect.stringContaining('BEGIN'),
        'SELECT 1',
        'SELECT 2',
        'SELECT 3',
        expect.stringContaining('COMMIT'),
      ]
      if (isSqlServer) {
        expectation.unshift(expect.stringContaining('SET TRANSACTION'))
      }

      await waitFor(() => expect(queries).toEqual(expectation))
    })
  },
  {
    skipDefaultClientInstance: true,
    optOut: {
      from: [Providers.MONGODB],
      reason: 'Test uses raw SQL queries',
    },
  },
)
