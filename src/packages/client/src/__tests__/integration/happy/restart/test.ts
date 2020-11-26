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
  let err
  try {
    await db.user.findMany()
  } catch (e) {
    err = e
  }
  expect(
    err.message.includes(
      'Please look into the logs or turn on the env var DEBUG=* to debug the constantly restarting query engine.',
    ),
  ).toBeTruthy()

  db.$disconnect()
})
