import { getTestClient } from '../../../../utils/getTestClient'

test('too-many-instances-of-prisma-client warning', async () => {
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
    await client.$disconnect()
  }

  expect(warnings).toMatchInlineSnapshot(`
    Array [
      warn(prisma-client) There are already 10 instances of Prisma Client actively running.,
    ]
  `)

  console.warn = oldConsoleWarn
})
