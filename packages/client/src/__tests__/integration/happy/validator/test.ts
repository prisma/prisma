import { generateTestClient } from '../../../../utils/getTestClient'

test('validator', async () => {
  await generateTestClient()

  const { PrismaClient, Prisma } = require('./node_modules/@prisma/client')

  const prisma = new PrismaClient()

  const select = Prisma.validator()({ id: true })

  const data = await prisma.user.findMany({ select })

  expect(data).toMatchInlineSnapshot(`
    [
      {
        id: 576eddf9-2434-421f-9a86-58bede16fd95,
      },
    ]
  `)

  await prisma.$disconnect()
})
