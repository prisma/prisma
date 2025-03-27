import { expectTypeOf } from 'expect-type'

import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('should work as createMany is supported', () => {
      prisma.user.createMany()

      expectTypeOf(prisma.user).toHaveProperty('createMany')
    })

    test('should fail as createManyAndReturn is not supported on tested providers', () => {
      // @ts-expect-error
      prisma.user.createManyAndReturn()

      expectTypeOf(prisma.user).not.toHaveProperty('createManyAndReturn')
    })
  },
  {
    optOut: {
      from: [Providers.POSTGRESQL, Providers.COCKROACHDB, Providers.SQLITE],
      reason:
        'Excluded dbs support the "ConnectorCapability::InsertReturning". This test is only about making sure that it does not show up where it is not supported.',
    },
  },
)
