import { getTestClient } from '../../../../utils/getTestClient'

test('missing-relation', async () => {
  expect.assertions(1)
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  await prisma.post.findMany({
    include: {
      author: true,
    },
  })

  // await expect(
  // ).rejects.toThrowErrorMatchingInlineSnapshot(`

  //         Invalid \`prisma.post.findMany()\` invocation in
  //         /client/src/__tests__/integration/errors/missing-relation/test.ts:9:17

  //            6 const prisma = new PrismaClient()
  //            7
  //            8 await expect(
  //         →  9   prisma.post.findMany(
  //           PANIC: Application logic invariant error: received null value for field author which may not be null

  //         This is a non-recoverable error which probably happens when the Prisma Query Engine has a panic.

  //         TEST_GITHUB_LINK

  //         If you want the Prisma team to look into it, please open the link above 🙏

  //       `)

  prisma.$disconnect()
})
