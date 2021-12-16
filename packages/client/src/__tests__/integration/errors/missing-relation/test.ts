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
    expect(e.message).toContain(`→  8   await prisma.post.findMany(`)
    expect(e.message).toContain(
      'Inconsistent query result: Field author is required to return data, got `null` instead.',
    )
  }

  await prisma.$disconnect()
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
