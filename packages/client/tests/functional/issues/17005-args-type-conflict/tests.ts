import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  // we don't really need a runtime test, we just need to check that types are generated correctly
  test('dummy', async () => {
    await expect(prisma.post.findFirst()).resolves.not.toThrow()
  })
})
