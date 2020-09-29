import { getTestClient } from '../../../../utils/getTestClient'

test('missing-table', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  try {
    await prisma.user.findMany()
  } catch (e) {
    expect(e.clientVersion).toMatchInlineSnapshot(`client-test-version`)
    expect(e).toMatchInlineSnapshot(`

      Invalid \`prisma.user.findMany()\` invocation in
      /client/src/__tests__/integration/errors/missing-table/test.ts:8:23


        The table \`dev.User\` does not exist in the current database.
    `)

    prisma.$disconnect()
  }
})
