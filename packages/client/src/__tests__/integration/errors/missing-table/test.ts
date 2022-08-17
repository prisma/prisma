import { generateTestClient } from '../../../../utils/getTestClient'

test('missing-table', async () => {
  expect.assertions(1)
  await generateTestClient()
  const { PrismaClient } = require('./node_modules/@prisma/client')
  const prisma = new PrismaClient()

  await expect(prisma.user.findMany()).rejects.toThrowErrorMatchingInlineSnapshot(`

          Invalid \`expect(prisma.user.findMany()\` invocation in
          /client/src/__tests__/integration/errors/missing-table/test.ts:0:0

             6 const { PrismaClient } = require('./node_modules/@prisma/client')
             7 const prisma = new PrismaClient()
             8 
          →  9 await expect(prisma.user.findMany()).rejects.toThrowErrorMatchingInlineSnapshot(
            The table \`main.User\` does not exist in the current database.
        `)

  await prisma.$disconnect()
})
