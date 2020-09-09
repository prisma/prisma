import { getTestClient } from '../../../../utils/getTestClient'

test('minimal', async () => {
  const PrismaClient = await getTestClient()
  const client = new PrismaClient()
  const users = await client.user.findMany()
  await client.$disconnect()
  expect(users).toMatchInlineSnapshot(`
    Array [
      Object {
        "email": "a@a.de",
        "id": "576eddf9-2434-421f-9a86-58bede16fd95",
        "name": "Alice",
      },
    ]
  `)
})
