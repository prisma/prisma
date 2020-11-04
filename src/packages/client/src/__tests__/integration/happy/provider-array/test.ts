import { getTestClient } from '../../../../utils/getTestClient'

test('provider-array', async () => {
  const warnings: any[] = []
  const oldWarn = console.warn
  console.warn = (...args) => {
    warnings.push(args)
  }
  const PrismaClient = await getTestClient(/* schemaDir */ undefined, true)
  const prisma = new PrismaClient()
  const users = await prisma.user.findMany()
  await prisma.$disconnect()
  expect(users).toMatchInlineSnapshot(`
    Array [
      Object {
        email: a@a.de,
        id: 576eddf9-2434-421f-9a86-58bede16fd95,
        name: Alice,
      },
    ]
  `)
  expect(warnings).toMatchInlineSnapshot(`
    Array [
      Array [
        warn Using multiple providers is now deprecated. You should use a single provider instead. Read more at https://pris.ly/multi-provider-deprecation,
      ],
    ]
  `)
  console.warn = oldWarn
})
