import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    // TODO: this currently fails with "The column `j1.id` does not exist in the current database.".
    // Close https://github.com/prisma/prisma/issues/21352 once fixed.
    test('[1] should not fail', async () => {
      await prisma.relation1.findMany({
        select: {
          id: true,
        },
        where: {
          user: {
            email: 'info@example.com',
          },
        },
      })
    })

    // TODO: this currently fails with "The column `j1.field` does not exist in the current database.".
    // Close https://github.com/prisma/prisma/issues/21352 once fixed.
    test('[2] should not fail', async () => {
      await prisma.relation2.findMany({
        select: {
          field: true,
        },
        where: {
          user: {
            id: 'info@example.com',
          },
        },
      })
    })
  },
  {
    optOut: {
      from: [Providers.MONGODB],
      reason: 'Only SQL databases were affected by regression #21352',
    },
  },
)
