import { generateTestClient } from '../../../../utils/getTestClient'

test('selectRelationCount', async () => {
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient
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
