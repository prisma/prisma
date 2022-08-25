// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.product.create({
        data: {
          title: 'Potato',
          quantity: 100,
          forbiddenQuantities: [1, 500, 100],
        },
      })

      await prisma.product.create({
        data: {
          title: 'Rice',
          quantity: 500,
          forbiddenQuantities: [10, 100, 1000],
        },
      })

      await prisma.product.create({
        data: {
          title: 'Tomato',
          forbiddenQuantities: [1, 500, 100],
          quantity: 30,
        },
      })
    })

    test('in', async () => {
      const products = await prisma.product.findMany({
        where: {
          quantity: { in: prisma.product.fields.forbiddenQuantities },
        },
      })

      expect(products).toEqual([expect.objectContaining({ title: 'Potato' })])
    })

    test('notIn', async () => {
      const products = await prisma.product.findMany({
        where: {
          quantity: { notIn: prisma.product.fields.forbiddenQuantities },
        },
      })

      expect(products).toEqual([
        expect.objectContaining({ title: 'Rice' }),
        expect.objectContaining({ title: 'Tomato' }),
      ])
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'sqlserver'],
      reason: 'Scalar lists are not supported',
    },
  },
)
