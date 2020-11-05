import { getTestClient } from '../../../../utils/getTestClient'

test('uncheckedScalarInputs', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  await prisma.user.deleteMany()
  const user = await prisma.user.create({
    data: {
      email: 'bob@bob.de',
      name: "Alice"
    },
  })

  const post = await prisma.post.create({
    data: {
      published: false,
      title: 'Mitle',
      content: 'Blub',
      authorId: user.id
    },
    include: {
      author: true
    }
  })

  expect(post.authorId).toEqual(user.id)
  expect(post.authorId).toEqual(post.author.id)
  await prisma.user.deleteMany()

  prisma.$disconnect()
})
