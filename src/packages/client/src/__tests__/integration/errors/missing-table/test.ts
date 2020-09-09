import { getTestClient } from '../../../../utils/getTestClient'

test('missing-table', async () => {
  expect.assertions(1)
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  await expect(prisma.user.findMany()).rejects
    .toThrowErrorMatchingInlineSnapshot(`

          Invalid \`prisma.user.findMany()\` invocation in
          /client/src/__tests__/integration/errors/missing-table/test.ts:8:28


            The table \`dev.User\` does not exist in the current database.
        `)

  prisma.$disconnect()
})
