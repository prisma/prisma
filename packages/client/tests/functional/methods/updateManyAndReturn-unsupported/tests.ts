import { expectTypeOf } from 'expect-type'

import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('should fail as updateManyAndReturn is not supported on tested providers', () => {
      // @ts-expect-error
      prisma.user.updateManyAndReturn()

      expectTypeOf(prisma.user).not.toHaveProperty('updateManyAndReturn')
    })
  },
  {
    optOut: {
      from: [Providers.POSTGRESQL, Providers.COCKROACHDB, Providers.SQLITE],
      reason:
        'Excluded dbs support the "ConnectorCapability::UpdateReturning". This test is only about making sure that it does not show up where it is not supported.',
    },
  },
)
