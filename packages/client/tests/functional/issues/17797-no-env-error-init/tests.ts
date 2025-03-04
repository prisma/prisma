// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import type { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  () => {
    test('instantiate works without failing', () => {
      newPrismaClient()
    })
  },
  {
    skipDefaultClientInstance: true,
    skipDb: true,
  },
)
