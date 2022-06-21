import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let PrismaClient: typeof import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  () => {
    const oldConsoleWarn = console.warn
    const warnings: any[] = []

    beforeAll(() => {
      console.warn = (args) => {
        warnings.push(args)
      }
    })

    afterAll(() => {
      console.warn = oldConsoleWarn
    })

    test('should console warn when spawning too many instances of PrismaClient', async () => {
      const clients: any[] = []
      for (let i = 0; i < 15; i++) {
        const client = new PrismaClient()
        await client.$connect()
        clients.push(client)
      }

      for (const client of clients) {
        client.$disconnect()
      }

      expect(warnings.join('')).toContain('There are already 10 instances of Prisma Client actively running')
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'sqlite', 'sqlserver'],
      reason: 'TODO - Test suite running in band causing issues running the console spy',
    },
  },
)
