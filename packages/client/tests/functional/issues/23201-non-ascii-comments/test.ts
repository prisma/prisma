import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('can connect to the DB', async () => {
    await expect(prisma.$connect()).resolves.not.toThrow()
  })
})
