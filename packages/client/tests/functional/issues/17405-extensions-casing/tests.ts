import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('empty', () => {
      expectTypeOf<
        PrismaNamespace.TypeMap['model']['user']['operations']['groupBy']['args']
      >().toEqualTypeOf<PrismaNamespace.userGroupByArgs>()
      ;async () => {
        await prisma.$extends({}).user.findFirst()
      }
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
  },
)
