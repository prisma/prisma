import { expectTypeOf } from 'expect-type'

import { ProviderFlavors } from '../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(({ provider, providerFlavor }) => {
  // TODO scalar lists don't work yet Unsupported column type: 1009 - tracked in https://github.com/prisma/team-orm/issues/374",
  $beforeAll({ failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON })(
    async () => {
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
    },
  )

  $test({
    failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON,
  })('includes scalars', async () => {
    const model = await prisma.model.findFirstOrThrow()

    expect(model.id).toBeDefined()
    expect(model.value).toBeDefined()
    expect(model.otherId).toBeDefined()
  })

  $test({
    failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON,
  })('does not include relations', async () => {
    const model = await prisma.model.findFirstOrThrow()

    expectTypeOf(model).not.toHaveProperty('relation')
    expect(model).not.toHaveProperty('relation')
  })

  $test({
    runIf: provider !== 'sqlite' && provider !== 'sqlserver',
    failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON,
  })('includes enums', async () => {
    const model = await prisma.model.findFirstOrThrow()

    // @ts-test-if: provider !== 'sqlite' && provider !== 'sqlserver'
    expect(model.enum).toBeDefined()
  })

  $test({
    runIf: provider === 'postgresql' || provider === 'cockroachdb' || provider === 'mongodb',
    failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON,
  })('includes lists', async () => {
    const model = await prisma.model.findFirstOrThrow()

    // @ts-test-if: provider === 'postgresql' || provider === 'cockroachdb' || provider === 'mongodb'
    expect(model.list).toBeDefined()
  })

  $test({
    runIf: provider === 'postgresql' || provider === 'cockroachdb' || provider === 'mongodb',
    failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON,
  })('includes enum lists', async () => {
    const model = await prisma.model.findFirstOrThrow()

    // @ts-test-if: provider === 'postgresql' || provider === 'cockroachdb' || provider === 'mongodb'
    expect(model.enumList).toBeDefined()
  })

  testIf(provider === 'mongodb')('includes composites', async () => {
    const model = await prisma.model.findFirstOrThrow()

    // @ts-test-if: provider === 'mongodb'
    expect(model.composite).toBeDefined()
  })
})
