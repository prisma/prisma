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
          <PROJECT_ROOT>/src/__tests__/integration/errors/incorrect-column-type/test.ts:15:28

            12   ],
            13 })
            14 
          → 15 await expect(prisma.user.findMany()).rejects.toThrowErrorMatchingInlineSnapshot(
            Attempted to serialize scalar '123' with incompatible type 'String' for field name.
        `)
  await prisma.$disconnect()
})
