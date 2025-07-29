import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('does not throw error', async () => {
    await expect(prisma.test.findFirst()).resolves.not.toThrow()
  })
})
