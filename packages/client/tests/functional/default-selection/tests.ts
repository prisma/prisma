import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(({ provider }) => {
  beforeAll(async () => {
    const input: Partial<PrismaNamespace.ModelCreateInput> = {
      value: 'Foo',
      relation: {
        create: {},
      },
    }

    if (provider !== 'sqlite' && provider !== 'sqlserver') {
      // @ts-test-if: provider !== 'sqlite' && provider !== 'sqlserver'
      input.enum = 'A'
    }

    if (provider === 'postgresql' || provider === 'cockroachdb' || provider === 'mongodb') {
      // @ts-test-if: provider === 'postgresql' || provider === 'cockroachdb' || provider === 'mongodb'
      input.list = ['Hello', 'world']
      // @ts-test-if: provider === 'postgresql' || provider === 'cockroachdb' || provider === 'mongodb'
      input.enumList = ['A', 'B']
    }

    if (provider === 'mongodb') {
      // @ts-test-if: provider === 'mongodb'
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

  testIf(provider !== 'sqlite' && provider !== 'sqlserver')('includes enums', async () => {
    const model = await prisma.model.findFirstOrThrow()

    // @ts-test-if: provider !== 'sqlite' && provider !== 'sqlserver'
    expect(model.enum).toBeDefined()
  })

  testIf(provider === 'postgresql' || provider === 'cockroachdb' || provider === 'mongodb')(
    'includes lists',
    async () => {
      const model = await prisma.model.findFirstOrThrow()

      // @ts-test-if: provider === 'postgresql' || provider === 'cockroachdb' || provider === 'mongodb'
      expect(model.list).toBeDefined()
    },
  )

  testIf(provider === 'postgresql' || provider === 'cockroachdb' || provider === 'mongodb')(
    'includes enum lists',
    async () => {
      const model = await prisma.model.findFirstOrThrow()

      // @ts-test-if: provider === 'postgresql' || provider === 'cockroachdb' || provider === 'mongodb'
      expect(model.enumList).toBeDefined()
    },
  )

  testIf(provider === 'mongodb')('includes composites', async () => {
    const model = await prisma.model.findFirstOrThrow()

    // @ts-test-if: provider === 'mongodb'
    expect(model.composite).toBeDefined()
  })
})
