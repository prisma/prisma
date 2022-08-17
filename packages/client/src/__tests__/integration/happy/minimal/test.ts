import { generateTestClient } from '../../../../utils/getTestClient'

test('minimal', async () => {
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient
  const prisma = new PrismaClient()
  const users = await prisma.user.findMany()
  await prisma.$disconnect()
  expect(users).toMatchInlineSnapshot(`
    Array [
      Object {
        email: a@a.de,
        id: 576eddf9-2434-421f-9a86-58bede16fd95,
        name: Alice,
      },
    ]
  `)
})
