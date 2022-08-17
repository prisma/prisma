import stripAnsi from 'strip-ansi'

import { generateTestClient } from '../../../../utils/getTestClient'

test('client colorless errorFormat argument', async () => {
  await generateTestClient()
  const { PrismaClient } = require('./node_modules/@prisma/client')
  const client = new PrismaClient({ errorFormat: 'colorless' })
  try {
    await client.user.findMany({ wrong: 'x' })
  } catch (e) {
    expect(stripAnsi(e.message) === e.message).toBeTruthy() // This is a workaround as snapshots seem to strip ansi characters
  }
  await client.$disconnect()
})
