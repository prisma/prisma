import { getTestClient } from '../../../../utils/getTestClient'

test.skip('uds', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient({
    __internal: {
      useUds: true,
    },
  })

  const result = await prisma.user.findMany()

  await prisma.$disconnect()
  expect(result).toMatchInlineSnapshot(`
    Array [
      Object {
        email: a@a.de,
        id: 576eddf9-2434-421f-9a86-58bede16fd95,
        name: Alice,
      },
    ]
  `)
})
