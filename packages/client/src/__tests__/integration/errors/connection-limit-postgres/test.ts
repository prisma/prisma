import { getTestClient } from '../../../../utils/getTestClient'

describe.skip('connection-limit-postgres', () => {
  // expect.assertions(1)
  const clients: any[] = []

  afterAll(async () => {
    await Promise.all(clients.map((c) => c.$disconnect()))
  })

  test('the client cannot query the db with 100 connections already open', async () => {
    const PrismaClient = await getTestClient()
    const connectionString = process.env.TEST_POSTGRES_ISOLATED_URI || 'postgres://prisma:prisma@localhost:5435/tests'

    for (let i = 0; i <= 100; i++) {
      const client = new PrismaClient({
        datasources: {
          db: { url: connectionString },
        },
      })
      clients.push(client)
    }

    try {
      for (const client of clients) {
        await client.$connect()
      }
    } catch (e) {
      expect(e.message).toMatch('Error querying the database: db error: FATAL: sorry, too many clients already')
    }
  }, 100_000)
})
