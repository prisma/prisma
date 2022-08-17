import { generateTestClient } from '../../../../utils/getTestClient'

test('incorrect-column-type', async () => {
  expect.assertions(1)
  await generateTestClient()
  const { PrismaClient } = require('./node_modules/@prisma/client')
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

            13   ],
            14 })
            15 
          → 16 await expect(prisma.user.findMany()).rejects.toThrowErrorMatchingInlineSnapshot(
            Error converting field "name" of expected non-nullable type "String", found incompatible value of "123".
        `)
  await prisma.$disconnect()
})
