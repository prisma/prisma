import { getTestClient } from '../../../../utils/getTestClient'

test('raw-transaction: queryRaw', async () => {
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
  if (process.env.PRISMA_FORCE_NAPI) {
    // TODO Should this really not be implemented? https://github.com/prisma/prisma/issues/7814
    expect(warnings).toMatchInlineSnapshot(`Array []`)
  } else {
    expect(warnings).toMatchInlineSnapshot(`
      Array [
        warn(prisma-client) Already 10 Prisma Clients are actively running.,
      ]
    `)
  }

  console.warn = oldConsoleWarn
})
