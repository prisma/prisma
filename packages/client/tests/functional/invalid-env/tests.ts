// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from '@prisma/client'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  () => {
    beforeAll(() => {
      const env = require('./prisma/env.json')
      Object.assign(process.env, env)
    })

    test('PrismaClientInitializationError for invalid env', async () => {
      const prisma = newPrismaClient()
      await expect(prisma.$connect()).rejects.toBeInstanceOf(Prisma.PrismaClientInitializationError)
    })
  },
  { skipDb: true, skipDefaultClientInstance: true }, // So we can maually call connect for this test
)
