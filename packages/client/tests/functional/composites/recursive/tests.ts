import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test.failing('can create recursive model', async () => {
      const result = await prisma.linkedList.create({
        data: {
          head: {
            value: 1,
            next: {
              value: 2,
              next: {
                value: 3,
                next: null,
              },
            },
          },
        },
      })

      expect(result).toMatchObject({
        head: {
          value: 1,
          next: {
            value: 2,
            next: {
              value: 3,
              next: null,
            },
          },
        },
      })
    })
  },
  {
    optOut: {
      from: [Providers.SQLSERVER, Providers.MYSQL, Providers.POSTGRESQL, Providers.COCKROACHDB, Providers.SQLITE],
      reason: 'Composites are only supported on mongo',
    },
  },
)
