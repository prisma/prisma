import { getTestClient } from '../../../../utils/getTestClient'

test('missing-table', async () => {
  expect.assertions(1)
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  await expect(prisma.user.findMany()).rejects
    .toThrowErrorMatchingInlineSnapshot(`

          Invalid \`expect(prisma.user.findMany()\` invocation in
          /client/src/__tests__/integration/errors/missing-table/test.ts:8:28

             5 const PrismaClient = await getTestClient()
             6 const prisma = new PrismaClient()
             7 
          →  8 await expect(prisma.user.findMany()).reject
            The table \`dev.User\` does not exist in the current database.
        `)

  prisma.$disconnect()
})
