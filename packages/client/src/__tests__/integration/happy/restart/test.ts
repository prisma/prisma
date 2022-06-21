import { ClientEngineType, getClientEngineType } from '@prisma/internals'

import { getTestClient } from '../../../../utils/getTestClient'

// Does Prisma Client restart the QE when it is killed for some reason?
test('restart', async () => {
  // No child process for Node-API, so nothing that can be killed or tested
  if (getClientEngineType() === ClientEngineType.Library) {
    return
  }

  const PrismaClient = await getTestClient()
  const db = new PrismaClient({
    errorFormat: 'colorless',
  })
  await db.user.findMany()

  // kill the binary child process
  db._engine.child.kill()
  await new Promise((r) => setTimeout(r, 1000))

  const result = await db.user.findMany()
  expect(result.length).toBeGreaterThan(0)

  // kill the binary child process again, to make sure it also comes back when engine is killed multiple times
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
