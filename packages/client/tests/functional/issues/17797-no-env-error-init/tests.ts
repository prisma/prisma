// @ts-ignore
import { PrismaClient } from '@prisma/client'

import { NewPrismaClient } from '../../_utils/types'
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
