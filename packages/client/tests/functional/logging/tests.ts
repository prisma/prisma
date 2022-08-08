import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
type PrismaClient = import('@prisma/client').PrismaClient
// @ts-ignore this is just for type checks
declare let newPrismaClient: NewPrismaClient<PrismaClient>

testMatrix.setupTestSuite(
  ({ provider, transactionBegin, transactionEnd }) => {
    test('basic event logging', async () => {
      const prisma = newPrismaClient({
        log: [
          {
            emit: 'event',
            level: 'info',
          },
          {
            emit: 'event',
            level: 'query',
          },
        ],
      })

      const onInfo = jest.fn()
      const onQuery = jest.fn()

      prisma.$on('info', onInfo)
      prisma.$on('query', onQuery)

      await prisma.user.findMany()

      expect(onInfo).toHaveBeenCalledWith({
        message: expect.stringMatching(/Starting a [a-z]+ pool with \d+ connections./),
        target: 'quaint::pooled',
        timestamp: expect.any(Date),
      })

      expect(onQuery).toHaveBeenCalledWith({
        duration: expect.any(Number),
        params: expect.any(String),
        query: expect.any(String),
        target: 'quaint::connector::metrics',
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
            duration: expect.any(Number),
            params: expect.any(String),
            query: transactionBegin,
            target: 'quaint::connector::metrics',
            timestamp: expect.any(Date),
          },
        ],

        [
          {
            duration: expect.any(Number),
            params: expect.any(String),
            query: expect.any(String),
            target: 'quaint::connector::metrics',
            timestamp: expect.any(Date),
          },
        ],
        [
          {
            duration: expect.any(Number),
            params: expect.any(String),
            query: transactionEnd,
            target: 'quaint::connector::metrics',
            timestamp: expect.any(Date),
          },
        ],
      ])
    })
  },
  {
    skipDefaultClientInstance: true,
    optOut: { from: ['mongodb'], reason: 'Logs look too different - see logging-mongo suite' },
  },
)
