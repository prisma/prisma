import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma } from './node_modules/@prisma/client'

testMatrix.setupTestSuite(
  () => {
    test('alias for count args types exists', () => {
      expectTypeOf<Prisma.GroupCountOutputTypeArgs>().toEqualTypeOf<Prisma.GroupCountOutputTypeDefaultArgs>()
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
  },
)
