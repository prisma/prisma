import { generateTestClient } from '../../../../utils/getTestClient'

test('missing-column', async () => {
  await generateTestClient()
  const { PrismaClient } = require('./node_modules/@prisma/client')
  const client = new PrismaClient()
  await expect(client.user.findMany()).rejects.toThrowErrorMatchingInlineSnapshot(`

          Invalid \`expect(client.user.findMany()\` invocation in
          /client/src/__tests__/integration/errors/missing-column/test.ts:0:0

             4 await generateTestClient()
             5 const { PrismaClient } = require('./node_modules/@prisma/client')
             6 const client = new PrismaClient()
          →  7 await expect(client.user.findMany()).rejects.toThrowErrorMatchingInlineSnapshot(
            The column \`main.User.name\` does not exist in the current database.
        `)
  client.$disconnect()
})
