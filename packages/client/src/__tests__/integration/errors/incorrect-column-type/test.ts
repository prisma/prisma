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

  await expect(prisma.user.findMany()).rejects.toThrowErrorMatchingInlineSnapshot(`

    Invalid \`expect(prisma.user.findMany()\` invocation in
    /client/src/__tests__/integration/errors/incorrect-column-type/test.ts:0:0

      12   ],
      13 })
      14 
    → 15 await expect(prisma.user.findMany(
    Error converting field "name" of expected non-nullable type "String", found incompatible value of "123".
  `)
  await prisma.$disconnect()
})
