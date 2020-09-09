import { getTestClient } from '../../../../utils/getTestClient'

test('incorrect-column-type', async () => {
  expect.assertions(1)
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  await expect(prisma.user.findMany()).rejects
    .toThrowErrorMatchingInlineSnapshot(`

          Invalid \`prisma.user.findMany()\` invocation in
          /client/src/__tests__/integration/errors/incorrect-column-type/test.ts:15:28


            Attempted to serialize scalar '123' with incompatible type 'String'
        `)
  prisma.$disconnect()
})
