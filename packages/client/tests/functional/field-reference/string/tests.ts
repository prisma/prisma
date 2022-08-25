// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
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

  test('wrong field type', async () => {
    const products = prisma.product.findMany({
      where: {
        string: {
          // @ts-expect-error
          equals: prisma.product.fields.notString,
        },
      },
    })

    await expect(products).rejects.toThrowErrorMatchingInlineSnapshot(`

      Invalid \`prisma.product.findMany()\` invocation in
      /client/tests/functional/field-reference/string/tests.ts:53:37

         50 })
         51 
         52 test('wrong field type', async () => {
      →  53   const products = prisma.product.findMany({
                where: {
                  string: {
                    equals: prisma.product.fields.notString
                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                  }
                }
              })

      Argument equals: Got invalid value prisma.product.fields.notString on prisma.findManyProduct. Provided IntFieldRefInput<Product>, expected String or StringFieldRefInput.


    `)
  })

  test('wrong model', async () => {
    const products = prisma.product.findMany({
      where: {
        string: {
          // @ts-expect-error
          equals: prisma.otherModel.fields.string,
        },
      },
    })

    await expect(products).rejects.toThrowErrorMatchingInlineSnapshot(`

      Invalid \`prisma.product.findMany()\` invocation in
      /client/tests/functional/field-reference/string/tests.ts:86:37

         83 })
         84 
         85 test('wrong model', async () => {
      →  86   const products = prisma.product.findMany({
                where: {
                  string: {
                    equals: prisma.otherModel.fields.string
                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                  }
                }
              })

      Argument equals: Got invalid value prisma.otherModel.fields.string on prisma.findManyProduct. Provided StringFieldRefInput<OtherModel>, expected String or StringFieldRefInput.


    `)
  })

  test('wrong identical model', async () => {
    const products = prisma.product.findMany({
      where: {
        string: {
          // @ts-expect-error
          equals: prisma.identicalToProduct.fields.string,
        },
      },
    })

    await expect(products).rejects.toThrowErrorMatchingInlineSnapshot(`

      Invalid \`prisma.product.findMany()\` invocation in
      /client/tests/functional/field-reference/string/tests.ts:119:37

        116 })
        117 
        118 test('wrong identical model', async () => {
      → 119   const products = prisma.product.findMany({
                where: {
                  string: {
                    equals: prisma.identicalToProduct.fields.string
                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                  }
                }
              })

      Argument equals: Got invalid value prisma.identicalToProduct.fields.string on prisma.findManyProduct. Provided StringFieldRefInput<IdenticalToProduct>, expected String or StringFieldRefInput.


    `)
  })
})
