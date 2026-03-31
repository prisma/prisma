import { Decimal } from '@prisma/client-runtime-utils'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('serializes Decimal nested in Json as a numeric JSON value', async () => {
      const record = await prisma.modelWithJson.create({
        data: {
          id: '1',
          properties: {
            someDecimal: new Decimal('-11000'),
          },
        },
      })

      expect(record.properties).toEqual({
        someDecimal: -11000,
      })
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'Issue #29387 reports the PostgreSQL Json path specifically.',
    },
  },
)
