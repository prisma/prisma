import { getTestClient } from '../../../../utils/getTestClient'

describe('connection-limit', () => {
  expect.assertions(1) 
  let clients: Array<any> = []

  afterAll(async () => {
    await Promise.all(clients.map(c => c.$disconnect()))
  })

  test('the client cannot query the db with 100 connections already open', async () => {
    const PrismaClient = await getTestClient()
    const connectionString =
      process.env.TEST_POSTGRES_ISOLATED_URI ||
      'postgres://prisma:prisma@localhost:5435/tests'
    for (let i = 0; i <= 100; i++) {
      const client = new PrismaClient({
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
        expect(e).toMatchSnapshot() 
      }
    }
  }, 100000)
})
