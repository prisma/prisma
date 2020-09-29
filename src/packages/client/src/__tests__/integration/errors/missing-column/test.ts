import { getTestClient } from '../../../../utils/getTestClient'

test('missing-column', async () => {
  const PrismaClient = await getTestClient()
  const client = new PrismaClient()
  try {
    await client.user.findMany()
  } catch (e) {
    expect(e.clientVersion).toMatchInlineSnapshot(`client-test-version`)
    expect(e).toMatchInlineSnapshot(`

      Invalid \`prisma.user.findMany()\` invocation in
      /client/src/__tests__/integration/errors/missing-column/test.ts:7:23


        The column \`dev.User.name\` does not exist in the current database.
    `)

    client.$disconnect()
  }
})
