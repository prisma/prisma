import { getTestClient } from '../../../../utils/getTestClient'

test('missing-column', async () => {
  const PrismaClient = await getTestClient()
  const client = new PrismaClient()
  await expect(client.user.findMany()).rejects
    .toThrowErrorMatchingInlineSnapshot(`

          Invalid \`prisma.user.findMany()\` invocation in
          /client/src/__tests__/integration/errors/missing-column/test.ts:6:28


            The column \`dev.User.name\` does not exist in the current database.
        `)
  client.$disconnect()
})
