import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import { Prisma as PrismaNamespace } from './node_modules/@prisma/client'

testMatrix.setupTestSuite(
  () => {
    test('empty', () => {
      expectTypeOf<
        PrismaNamespace.TypeMap['model']['user']['groupBy']['args']
      >().toEqualTypeOf<PrismaNamespace.UserGroupByArgs>()
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
  },
)
