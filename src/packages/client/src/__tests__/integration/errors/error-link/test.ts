import { getTestClient } from '../../../../utils/getTestClient'
const stripAnsi = require('strip-ansi')

test('error-link', async () => {
  const PrismaClient = await getTestClient()
  const db = new PrismaClient({
    __internal: {
      engine: {
        enableEngineDebugMode: true,
      },
    },
  })

  try {
    await db.__internal_triggerPanic(true)
  } catch (e) {
    expect(
      stripAnsi(e.message).includes(
        'Query engine debug fatal error, shutting down.',
      ),
    ).toBe(true)
  }

  db.$disconnect()
})
