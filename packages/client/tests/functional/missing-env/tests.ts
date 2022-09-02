import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  () => {
    test('PrismaClientInitializationError for missing env', async () => {
      const prisma = newPrismaClient()
      await expect(prisma.$connect()).rejects.toBeInstanceOf(Prisma.PrismaClientInitializationError)
    })
  },
  { skipDb: true, skipDefaultClientInstance: true }, // So we can manually call connect for this test
)
