import { getTestClient } from '../../../../utils/getTestClient'

test('restart', async () => {
  const PrismaClient = await getTestClient()
  const db = new PrismaClient({
    errorFormat: 'colorless',
  })

  await db.user.findMany()

  db._engine.child.kill()

  await new Promise((r) => setTimeout(r, 1000))

  const result = await db.user.findMany()
  expect(result.length).toBeGreaterThan(0)

  for (let i = 0; i < 7; i++) {
    db._engine.child.kill()
    await new Promise((r) => setTimeout(r, 200))
  }
  const result2 = await db.user.findMany()
  expect(result2).toMatchInlineSnapshot(`
    Array [
      Object {
        email: a@a.de,
        id: 576eddf9-2434-421f-9a86-58bede16fd95,
        name: Alice,
      },
    ]
  `)

  db.$disconnect()
})
