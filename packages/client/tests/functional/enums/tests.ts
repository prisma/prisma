import { expectTypeOf } from 'expect-type'

// @ts-ignore
import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'
import type * as imports from './node_modules/@prisma/client'

declare let prisma: imports.PrismaClient
declare let loaded: {
  Plan: typeof imports.Plan
}

testMatrix.setupTestSuite(
  ({ provider }) => {
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

    testIf(provider === Providers.SQLITE)(
      'fails at runtime when an invalid entry is entered manually in SQLite',
      async () => {
        // @ts-test-if: provider !== Providers.MONGODB
        await prisma.$executeRaw`INSERT INTO "User" ("id", "plan") VALUES ('2', 'NONFREE')`
        const result = await prisma.user.findMany().catch((e) => e)

        expect(result).toBeInstanceOf(Error)
        expect(result.message).toMatch(/Value 'NONFREE' not found in enum 'Plan'/)
      },
    )

    testIf(provider === Providers.MONGODB)(
      'fails at runtime when an invalid entry is entered manually in Mongo',
      async () => {
        // @ts-test-if: provider === Providers.MONGODB
        await prisma.$runCommandRaw({
          insert: 'User',
          documents: [
            {
              _id: '2',
              plan: 'NONFREE',
            },
          ],
        })
        const result = await prisma.user.findMany().catch((e) => e)

        expect(result).toBeInstanceOf(Error)
        expect(result.message).toMatch(/Value 'NONFREE' not found in enum 'Plan'/)
      },
    )
  },
  {
    optOut: {
      from: ['sqlserver'],
      reason: 'enum values are not supported',
    },
  },
)
