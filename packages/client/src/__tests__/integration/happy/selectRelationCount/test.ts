import { getTestClient } from '../../../../utils/getTestClient'

test('selectRelationCount', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  const users = await prisma.user.findMany({
    include: {
      _count: true,
    },
  })
  await prisma.$disconnect()
  expect(users).toMatchInlineSnapshot(`
    Array [
      Object {
        _count: Object {
          posts: 0,
        },
        email: a@a.de,
        id: 576eddf9-2434-421f-9a86-58bede16fd95,
        name: Alice,
      },
    ]
  `)
})
