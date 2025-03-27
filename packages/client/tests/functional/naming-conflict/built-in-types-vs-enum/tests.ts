import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('allows to create enum with conflicting name', async () => {
      await prisma.enumHolder.create({ data: { value: 'ONE' } })
      const data = await prisma.enumHolder.findFirstOrThrow()

      expect(data.value).toBe('ONE')
      expectTypeOf(data.value).toEqualTypeOf<'ONE' | 'TWO'>()
    })
  },
  {
    optOut: {
      from: ['sqlite', 'sqlserver'],
      reason: 'Enums are not supported',
    },
  },
)
