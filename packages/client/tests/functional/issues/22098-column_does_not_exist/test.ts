import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('does not throw error', async () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    await expect(prisma.test.findFirst()).resolves.not.toThrow()
  })
})
