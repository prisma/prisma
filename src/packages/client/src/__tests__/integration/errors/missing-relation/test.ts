import { getTestClient } from '../../../../utils/getTestClient'

test('missing-relation', async () => {
  expect.assertions(2)
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  try {
    await prisma.post.findMany({
      include: {
        author: true,
      },
    })
  } catch (e) {
    expect(e.message).toContain('PANIC')
    expect(e.message).toContain(
      'Application logic invariant error: received null value for field author which may not be null',
    )
  }
})

// Please don't remove, this is used to debug this test

// async function main() {
//   const PrismaClient = await getTestClient()
//   const prisma = new PrismaClient()
//   await prisma.post.findMany({
//     include: {
//       author: true,
//     },
//   })
// }

// main().catch((e) => console.error(e))
