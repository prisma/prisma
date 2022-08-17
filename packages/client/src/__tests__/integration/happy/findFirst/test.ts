import { generateTestClient } from '../../../../utils/getTestClient'

let PrismaClient
beforeAll(async () => {
  await generateTestClient()
  PrismaClient = require('./node_modules/@prisma/client').PrismaClient
})

test('findFirst with a result', async () => {
  const prisma = new PrismaClient()
  const user = await prisma.user.findFirst()
  await prisma.$disconnect()
  expect(user).toMatchInlineSnapshot(`
    Object {
      email: a@a.de,
      id: 576eddf9-2434-421f-9a86-58bede16fd95,
      name: Alice,
    }
  `)
})

test('findFirst without a result', async () => {
  const prisma = new PrismaClient()
  const user = await prisma.user.findFirst({
    where: {
      email: 'asdasd',
    },
  })
  await prisma.$disconnect()
  expect(user).toMatchInlineSnapshot(`null`)
})
