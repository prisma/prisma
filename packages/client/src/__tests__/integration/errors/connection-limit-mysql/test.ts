import { ClientEngineType, getClientEngineType } from '@prisma/internals'

import { getTestClient } from '../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describeIf(process.platform === 'linux')('connection-limit-mysql', () => {
  const clients: any[] = []

  afterAll(async () => {
    if (getClientEngineType() === ClientEngineType.Binary) {
      expect.assertions(1)
      try {
        await Promise.all(clients.map((c) => c.$disconnect()))
      } catch (e) {
        // When using the binary engine the error is thrown here :thinking:
        expect(e.message).toMatchInlineSnapshot(
          `Error querying the database: Server error: \`ERROR HY000 (1040): Too many connections'`,
        )
      }
    } else {
      await Promise.all(clients.map((c) => c.$disconnect()))
    }
  })

  test('the client cannot query the db with 152 connections already open', async () => {
    expect.assertions(1)
    const PrismaClient = await getTestClient()
    const connectionString = process.env.TEST_MYSQL_ISOLATED_URI!

    for (let i = 0; i <= 155; i++) {
      const client = new PrismaClient({
        datasources: {
          db: { url: connectionString },
        },
      })
      clients.push(client)
    }
    let count = 0
    try {
      for (const client of clients) {
        await client.$connect()
        count++
      }
    } catch (e) {
      expect(e.message).toMatchInlineSnapshot(
        `Error querying the database: Server error: \`ERROR HY000 (1040): Too many connections'`,
      )
    }
  }, 200_000)
})
