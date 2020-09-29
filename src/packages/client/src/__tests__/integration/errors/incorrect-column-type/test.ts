import { getTestClient } from '../../../../utils/getTestClient'

test('incorrect-column-type', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  try {
    await prisma.user.findMany()
  } catch (e) {
    expect(e.clientVersion).toMatchInlineSnapshot(`client-test-version`)
    expect(e).toMatchInlineSnapshot(`

      Invalid \`prisma.user.findMany()\` invocation in
      /client/src/__tests__/integration/errors/incorrect-column-type/test.ts:15:23


        Attempted to serialize scalar '123' with incompatible type 'String'
    `)

    prisma.$disconnect()
  }
})
