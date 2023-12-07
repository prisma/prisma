import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type * as imports from './node_modules/@prisma/client'

declare let prisma: imports.PrismaClient
declare let loaded: {
  Plan: typeof imports.Plan
}

testMatrix.setupTestSuite(
  () => {
    test('can create data with an enum value', async () => {
      const { Plan } = loaded

      await prisma.user.create({
        data: {
          plan: Plan.CUSTOM,
        },
      })
    })

    test('can retrieve data with an enum value', async () => {
      const { Plan } = loaded

      const user = await prisma.user.create({
        data: {
          plan: Plan.CUSTOM,
        },
      })

      const data = await prisma.user.findFirstOrThrow({
        where: {
          id: user.id,
          plan: Plan.CUSTOM,
        },
      })

      expectTypeOf(data.plan).toEqualTypeOf<imports.Plan>()
      expect(data.plan).toEqual(Plan.CUSTOM)
    })

    test('the enum type can be assigned its own values', () => {
      const { Plan } = loaded

      const value: imports.Plan = Plan.CUSTOM

      expect(value).toEqual(Plan.CUSTOM)
      expect(value).toEqual('CUSTOM')
      expectTypeOf(value).toEqualTypeOf<'CUSTOM'>()
      expectTypeOf<imports.Plan>().toEqualTypeOf<'CUSTOM' | 'FREE' | 'PAID'>()
    })
  },
  {
    optOut: {
      from: ['sqlite', 'sqlserver'],
      reason: 'enum values are not supported',
    },
  },
)
