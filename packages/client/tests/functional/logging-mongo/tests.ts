import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

// @ts-ignore this is just for type checks
type PrismaClient = import('@prisma/client').PrismaClient
// @ts-ignore this is just for type checks
declare let newPrismaClient: NewPrismaClient<PrismaClient>

testMatrix.setupTestSuite(
  () => {
    test('basic event logging', async () => {
      const prisma = newPrismaClient({
        log: [
          {
            emit: 'event',
            level: 'query',
          },
        ],
      })

      const onQuery = jest.fn()

      prisma.$on('query', onQuery)

      await prisma.user.findMany()

      expect(onQuery).toHaveBeenCalledWith({
        params: expect.any(String),
        query: expect.any(String),
        target: 'mongodb_query_connector::query',
        timestamp: expect.any(Date),
      })
    })

    test('interactive transactions logging', async () => {
      const prisma = newPrismaClient({
        log: [
          {
            emit: 'event',
            level: 'query',
          },
        ],
      })

      const onQuery = jest.fn()

      prisma.$on('query', onQuery)

      await prisma.$transaction(async (tx) => {
        await tx.user.findMany()
      })

      expect(onQuery.mock.calls).toEqual([
        [
          {
            params: expect.any(String),
            query: expect.any(String),
            target: 'mongodb_query_connector::query',
            timestamp: expect.any(Date),
          },
        ],
      ])
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'mysql', 'cockroachdb', 'sqlserver'],
      reason: 'SQL databases tested in logging suite',
    },
  },
)
