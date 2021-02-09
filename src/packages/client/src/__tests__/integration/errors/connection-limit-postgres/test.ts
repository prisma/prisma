import { getTestClient } from '../../../../utils/getTestClient'

describe('connection-limit-postgres', () => {
  expect.assertions(1)
  const clients: any[] = []

  afterAll(async () => {
    await Promise.all(clients.map((c) => c.$disconnect()))
  })

  test('error', async () => {
    const PrismaClient = await getTestClient()
    const connectionString = process.env.TEST_POSTGRES_ISOLATED_URI
    console.log(connectionString);
    for (let i = 0; i <= 10; i++) {
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
      expect(e.message).toMatch(
        'Error querying the database: db error: FATAL: sorry, too many clients already',
      )
    }
  }, 20_000)
})
