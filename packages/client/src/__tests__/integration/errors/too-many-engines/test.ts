import { getTestClient } from '../../../../utils/getTestClient'

test('too-many-engines warning', async () => {
  const PrismaClient = await getTestClient()
  const oldConsoleWarn = console.warn
  const warnings: any[] = []
  console.warn = (args) => {
    warnings.push(args)
  }

  const clients: any[] = []
  for (let i = 0; i < 15; i++) {
    const client = new PrismaClient()
    await client.$connect()
    clients.push(client)
  }

  for (const client of clients) {
    client.$disconnect()
  }

  expect(warnings).toMatchInlineSnapshot(`
    Array [
      warn(prisma-client) Already 10 Prisma Clients are actively running.,
    ]
  `)

  console.warn = oldConsoleWarn
})
