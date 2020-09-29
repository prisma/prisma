import { getTestClient } from '../../../../utils/getTestClient'

test('missing-relation', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  try {
    await prisma.post.findMany({
      include: {
        author: true,
      },
    })
  } catch (e) {
    expect(e.clientVersion).toMatchInlineSnapshot(`client-test-version`)
    expect(e).toMatchInlineSnapshot(`

      Invalid \`prisma.post.findMany()\` invocation in
      /client/src/__tests__/integration/errors/missing-relation/test.ts:8:23


        PANIC: Application logic invariant error: received null value for field author which may not be null

      This is a non-recoverable error which probably happens when the Prisma Query Engine has a panic.

      TEST_GITHUB_LINK

      If you want the Prisma team to look into it, please open the link above 🙏

    `)

    prisma.$disconnect()
  }
})
