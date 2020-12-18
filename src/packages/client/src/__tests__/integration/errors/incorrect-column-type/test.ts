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

  try {
    await prisma.user.findMany()
  } catch (e) {
    expect(e).toMatchInlineSnapshot(`

      Invalid \`prisma.user.findMany()\` invocation in
      /client/src/__tests__/integration/errors/incorrect-column-type/test.ts:16:23

        13 })
        14 
        15 try {
      → 16   await prisma.user.findMany(
        Attempted to serialize scalar '123' with incompatible type 'String'
    `)
  }
  prisma.$disconnect()
})
