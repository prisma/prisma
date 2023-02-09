import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import { PrismaClient } from './node_modules/@prisma/client'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  () => {
    test('instantiate works without failing', () => {
      const prisma = newPrismaClient()
    })
  },
  {
    skipDefaultClientInstance: true,
    skipDb: true,
  },
)
