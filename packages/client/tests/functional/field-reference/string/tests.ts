import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite((_suiteConfig, _suiteMeta, { runtime }) => {
  beforeAll(async () => {
    await prisma.product.create({
      data: {
        string: 'hello',
        otherString: 'world',
        notString: 0,
      },
    })

    await prisma.product.create({
      data: {
        string: 'hello',
        otherString: 'hello',
        notString: 0,
      },
    })

    await prisma.product.create({
      data: {
        string: 'hello world',
        otherString: 'hello',
        notString: 0,
      },
    })
  })

  test('simple equality', async () => {
    const products = await prisma.product.findMany({ where: { string: { equals: prisma.product.fields.otherString } } })

    expect(products).toEqual([expect.objectContaining({ string: 'hello', otherString: 'hello' })])
  })

  test('advanced filter', async () => {
    const products = await prisma.product.findMany({
      where: { string: { startsWith: prisma.product.fields.otherString } },
    })

    expect(products).toEqual([
      expect.objectContaining({ string: 'hello', otherString: 'hello' }),
      expect.objectContaining({ string: 'hello world', otherString: 'hello' }),
    ])
  })

  // TODO: Edge: skipped because of the error snapshot
  testIf(runtime !== 'edge')('wrong field type', async () => {
    const products = prisma.product.findMany({
      where: {
        string: {
          // @ts-expect-error
          equals: prisma.product.fields.notString,
        },
      },
    })

    await expect(products).rejects.toMatchPrismaErrorInlineSnapshot(`

            Invalid \`prisma.product.findMany()\` invocation in
            /client/tests/functional/field-reference/string/tests.ts:0:0

              XX 
              XX // TODO: Edge: skipped because of the error snapshot
              XX testIf(runtime !== 'edge')('wrong field type', async () => {
            → XX   const products = prisma.product.findMany(
            Input error. Expected a referenced scalar field of type String but found Product.notString of type Int.
        `)
  })

  // TODO: Edge: skipped because of the error snapshot
  testIf(runtime !== 'edge')('wrong model', async () => {
    const products = prisma.product.findMany({
      where: {
        string: {
          // @ts-expect-error
          equals: prisma.otherModel.fields.string,
        },
      },
    })

    await expect(products).rejects.toMatchPrismaErrorInlineSnapshot(`

            Invalid \`prisma.product.findMany()\` invocation in
            /client/tests/functional/field-reference/string/tests.ts:0:0

              XX 
              XX // TODO: Edge: skipped because of the error snapshot
              XX testIf(runtime !== 'edge')('wrong model', async () => {
            → XX   const products = prisma.product.findMany(
            Input error. Expected a referenced scalar field of model Product, but found a field of model OtherModel.
        `)
  })

  // TODO: Edge: skipped because of the error snapshot
  testIf(runtime !== 'edge')('wrong identical model', async () => {
    const products = prisma.product.findMany({
      where: {
        string: {
          // @ts-expect-error
          equals: prisma.identicalToProduct.fields.string,
        },
      },
    })

    await expect(products).rejects.toMatchPrismaErrorInlineSnapshot(`

      Invalid \`prisma.product.findMany()\` invocation in
      /client/tests/functional/field-reference/string/tests.ts:0:0

         XX 
         XX // TODO: Edge: skipped because of the error snapshot
        XX testIf(runtime !== 'edge')('wrong identical model', async () => {
      → XX   const products = prisma.product.findMany(
      Input error. Expected a referenced scalar field of model Product, but found a field of model IdenticalToProduct.
    `)
  })
})
