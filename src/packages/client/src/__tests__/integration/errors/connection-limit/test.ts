import { getTestClient } from '../../../../utils/getTestClient'

describe('connection-limit', () => {
  let clients: Array<any> = []

  afterAll(async () => {
    for (const client of clients) {
      await client.$disconnect()
    }
  })

  test('connection', async () => {
    for (let i = 0; i <= 100; i++) {
      const prismaClient = await getTestClient()
      const connectionString = 'postgres://prisma:prisma@localhost:5435/'
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
  }, 40000)
})
