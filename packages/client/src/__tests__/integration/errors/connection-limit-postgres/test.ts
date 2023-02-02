import { ClientEngineType, getClientEngineType } from '@prisma/internals'

import { getTestClient } from '../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describeIf(process.platform === 'linux')('connection-limit-postgres', () => {
  const clients: any[] = []

  afterAll(async () => {
    if (getClientEngineType() === ClientEngineType.Binary) {
      // eslint-disable-next-line jest/no-standalone-expect
      expect.assertions(1)
      try {
        await Promise.all(clients.map((c) => c.$disconnect()))
      } catch (e) {
        // When using the binary engine the error is thrown here :thinking:
        // eslint-disable-next-line jest/no-standalone-expect
        expect(e.message).toMatchInlineSnapshot(
          `Error querying the database: db error: FATAL: sorry, too many clients already`,
        )
      }
    } else {
      await Promise.all(clients.map((c) => c.$disconnect()))
    }
  })

  test('the client cannot query the db with 100 connections already open', async () => {
    expect.assertions(1)
    const PrismaClient = await getTestClient()
    const connectionString = process.env.TEST_POSTGRES_ISOLATED_URI!

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
  }, 200_000)
})
