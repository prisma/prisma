import { getTestClient } from '../../../../utils/getTestClient'

describe('connection-limit', () => {
  expect.assertions(1) // cannot have any clients currently connected to db.
  let clients: Array<any> = []

  afterAll(async () => {
    for (const client of clients) {
      await client.$disconnect()
    }
  })

  test('connection', async () => {
    for (let i = 0; i <= 100; i++) {
      const prismaClient = await getTestClient()
      const connectionString =
        process.env.TEST_POSTGRES_ISOLATED_URI || 'postgres://localhost:5435/'
      const client = new prismaClient({
        formatting: 'minimal',
        datasources: {
          db: { url: connectionString },
        },
      })
      try {
        await client.$connect()
        clients.push(client)
        await client.$queryRaw(`SELECT 1`)
      } catch (e) {
        expect(e).toMatchSnapshot() // should fail on 100th iteration.
      }
    }
  }, 50000)
})
