import { getTestClient } from '../../../../utils/getTestClient'

test('missing-column', async () => {
  const PrismaClient = await getTestClient()
  const client = new PrismaClient()
  await expect(client.user.findMany()).rejects.toThrowErrorMatchingInlineSnapshot(`

          Invalid \`expect(client.user.findMany()\` invocation in
          /client/src/__tests__/integration/errors/missing-column/test.ts:0:0

            3 test('missing-column', async () => {
            4   const PrismaClient = await getTestClient()
            5   const client = new PrismaClient()
          → 6   await expect(client.user.findMany()).rejects.toThrowErrorMatchingInlineSnapshot(
            The column \`main.User.name\` does not exist in the current database.
        `)
  await client.$disconnect()
})
