import { expectTypeOf } from 'expect-type'

import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(({ provider }) => {
  beforeAll(async () => {
    const input: Partial<PrismaNamespace.ModelCreateInput> = {
      value: 'Foo',
      relation: {
        create: {},
      },
    }

    if (provider !== Providers.SQLITE && provider !== Providers.SQLSERVER) {
      // @ts-test-if: provider !== Providers.SQLITE && provider !== Providers.SQLSERVER
      input.enum = 'A'
    }

    if (provider === Providers.POSTGRESQL || provider === Providers.COCKROACHDB || provider === Providers.MONGODB) {
      // @ts-test-if: provider === Providers.POSTGRESQL || provider === Providers.COCKROACHDB || provider === Providers.MONGODB
      input.list = ['Hello', 'world']
      // @ts-test-if: provider === Providers.POSTGRESQL || provider === Providers.COCKROACHDB || provider === Providers.MONGODB
      input.enumList = ['A', 'B']
    }

    if (provider === Providers.MONGODB) {
      // @ts-test-if: provider === Providers.MONGODB
      input.composite = { value: 'I am composite' }
    }

    await prisma.model.create({ data: input as PrismaNamespace.ModelCreateInput })
  })

  test('includes scalars', async () => {
    const model = await prisma.model.findFirstOrThrow()

    expect(model.id).toBeDefined()
    expect(model.value).toBeDefined()
    expect(model.otherId).toBeDefined()
  })

  test('does not include relations', async () => {
    const model = await prisma.model.findFirstOrThrow()

    expectTypeOf(model).not.toHaveProperty('relation')
    expect(model).not.toHaveProperty('relation')
  })

  testIf(provider !== Providers.SQLITE && provider !== Providers.SQLSERVER)('includes enums', async () => {
    const model = await prisma.model.findFirstOrThrow()

    // @ts-test-if: provider !== Providers.SQLITE && provider !== Providers.SQLSERVER
    expect(model.enum).toBeDefined()
  })

  testIf(provider === Providers.POSTGRESQL || provider === Providers.COCKROACHDB || provider === Providers.MONGODB)(
    'includes lists',
    async () => {
      const model = await prisma.model.findFirstOrThrow()

      // @ts-test-if: provider === Providers.POSTGRESQL || provider === Providers.COCKROACHDB || provider === Providers.MONGODB
      expect(model.list).toBeDefined()
    },
  )

  testIf(provider === Providers.POSTGRESQL || provider === Providers.COCKROACHDB || provider === Providers.MONGODB)(
    'includes enum lists',
    async () => {
      const model = await prisma.model.findFirstOrThrow()

      // @ts-test-if: provider === Providers.POSTGRESQL || provider === Providers.COCKROACHDB || provider === Providers.MONGODB
      expect(model.enumList).toBeDefined()
    },
  )

  testIf(provider === Providers.MONGODB)('includes composites', async () => {
    const model = await prisma.model.findFirstOrThrow()

    // @ts-test-if: provider === Providers.MONGODB
    expect(model.composite).toBeDefined()
  })
})
