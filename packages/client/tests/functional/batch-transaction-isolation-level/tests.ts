import { waitFor } from '../_utils/tests/waitFor'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  (_suiteConfig, _suiteMeta, clientMeta) => {
    const queries: string[] = []
    let prisma: PrismaClient<PrismaNamespace.PrismaClientOptions, 'query'>

    beforeAll(() => {
      prisma = newPrismaClient({
        log: [
          {
            emit: 'event',
            level: 'query',
          },
        ],
      })

      prisma.$on('query', (event) => {
        queries.push(event.query)
      })
    })

    afterEach(() => {
      queries.length = 0
    })

    const testIsolationLevel = (
      name: string,
      { level, expectSql }: { level: () => PrismaNamespace.TransactionIsolationLevel; expectSql: string },
    ) => {
      test(name, async () => {
        await prisma.$transaction([prisma.user.findFirst({}), prisma.user.findFirst({})], {
          isolationLevel: level(),
        })

        await waitFor(() => {
          expect(queries).toContain(expectSql)
        })
      })
    }

    testIsolationLevel('ReadUncommitted', {
      level: () => Prisma.TransactionIsolationLevel.ReadUncommitted,
      expectSql: 'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED',
    })

    testIsolationLevel('ReadCommitted', {
      level: () => Prisma.TransactionIsolationLevel.ReadCommitted,
      expectSql: 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
    })

    testIsolationLevel('RepeatableRead', {
      level: () => Prisma.TransactionIsolationLevel.RepeatableRead,
      expectSql: 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ',
    })

    testIsolationLevel('Serializable', {
      level: () => Prisma.TransactionIsolationLevel.Serializable,
      expectSql: 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE',
    })

    test('default value generates no SET TRANSACTION ISOLATION LEVEL statements', async () => {
      await prisma.$transaction([prisma.user.findFirst({}), prisma.user.findFirst({})])

      expect(queries.find((q) => q.includes('SET TRANSACTION ISOLATION LEVEL'))).toBeUndefined()
    })

    // TODO: skipped on edge client because of error snapshot
    testIf(clientMeta.runtime !== 'edge')('invalid level generates run- and compile- time error', async () => {
      // @ts-expect-error
      const result = prisma.$transaction([prisma.user.findFirst({}), prisma.user.findFirst({})], {
        isolationLevel: 'yes',
      })

      await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`

        Invalid \`prisma.$transaction([prisma.user.findFirst()\` invocation in
        /client/tests/functional/batch-transaction-isolation-level/tests.ts:0:0

          XX // TODO: skipped on edge client because of error snapshot
          XX testIf(clientMeta.runtime !== 'edge')('invalid level generates run- and compile- time error', async () => {
          XX   // @ts-expect-error
        → XX   const result = prisma.$transaction([prisma.user.findFirst(
        Inconsistent column data: Conversion failed: Invalid isolation level \`yes\`
      `)
    })
  },
  {
    optOut: {
      from: ['mongodb', 'sqlite', 'cockroachdb'],
      reason: `
        mongo - Not supported
        sqlite, cockroach - Support only serializable level, never generate sql for setting isolation level
      `,
    },
    skipDefaultClientInstance: true,
  },
)
