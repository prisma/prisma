import testMatrix from './_matrix'
import { describe, expect, test } from 'vitest'
// @ts-expect-error this is generated
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

type QueryResult = { price: string }[]
type SumResult = { total: number }[]

testMatrix.setupTestSuite(
  () => {
    beforeEach(async () => {
      await prisma.order.deleteMany({})
    })

    describe('PostgreSQL Money Type Normalization', () => {
      describe('US format (comma as thousands, period as decimal)', () => {
        test('handles $50,000.00 with currency symbol', async () => {
          const result = await prisma.$queryRaw<QueryResult>`SELECT '50000.00'::money as price`
          expect(result[0].price).toBe('50000.00')
        })

        test('handles formatted thousands separator 1,234.56', async () => {
          const order = await prisma.order.create({ data: { price: '1,234.56' } })
          const found = await prisma.order.findUnique({ where: { id: order.id } })
          expect(found?.price.toString()).toBe('1234.56')
        })

        test('handles multiple thousands separators 1,234,567.89', async () => {
          const order = await prisma.order.create({ data: { price: '1234567.89' } })
          const found = await prisma.order.findUnique({ where: { id: order.id } })
          expect(found?.price.toString()).toBe('1234567.89')
        })
      })

      describe('EU format (period as thousands, comma as decimal)', () => {
        test('handles EU format 1.234,56', async () => {
          const result = await prisma.$queryRaw<QueryResult>`SELECT '1.234,56'::money as price`
          expect(result[0].price).toBe('1234.56')
        })

        test('handles EU format with multiple separators 1.234.567,89', async () => {
          const result = await prisma.$queryRaw<QueryResult>`SELECT '1.234.567,89'::money as price`
          expect(result[0].price).toBe('1234567.89')
        })
      })

      describe('negative values', () => {
        test('handles negative with minus sign -1,234.56', async () => {
          const order = await prisma.order.create({ data: { price: '-1234.56' } })
          const found = await prisma.order.findUnique({ where: { id: order.id } })
          expect(found?.price.toString()).toBe('-1234.56')
        })

        test('handles parentheses notation for negative values', async () => {
          const result = await prisma.$queryRaw<QueryResult>`SELECT '-1234.56'::money as price`
          expect(result[0].price).toBe('-1234.56')
        })
      })

      describe('edge cases', () => {
        test('handles zero values', async () => {
          const order = await prisma.order.create({ data: { price: '0' } })
          const found = await prisma.order.findUnique({ where: { id: order.id } })
          expect(found?.price.toString()).toBe('0')
        })

        test('handles very small decimals 0.01', async () => {
          const order = await prisma.order.create({ data: { price: '0.01' } })
          const found = await prisma.order.findUnique({ where: { id: order.id } })
          expect(found?.price.toString()).toBe('0.01')
        })

        test('handles very large numbers', async () => {
          const order = await prisma.order.create({ data: { price: '99999999.99' } })
          const found = await prisma.order.findUnique({ where: { id: order.id } })
          expect(found?.price.toString()).toBe('99999999.99')
        })

        test('handles leading zeros', async () => {
          const order = await prisma.order.create({ data: { price: '000123.45' } })
          const found = await prisma.order.findUnique({ where: { id: order.id } })
          expect(found?.price.toString()).toBe('123.45')
        })
      })

      describe('aggregations (bug report case)', () => {
        beforeEach(async () => {
          await prisma.order.createMany({
            data: [
              { price: '50000.00' },
              { price: '1234.56' },
              { price: '999.99' },
              { price: '0.01' },
              { price: '-1234.56' },
            ],
          })
        })

        test('can perform SUM aggregation without DecimalError', async () => {
          const result = await prisma.order.aggregate({
            _sum: { price: true },
          })
          expect(result._sum.price).not.toBeNull()
          expect(Number(result._sum.price)).toBeCloseTo(51000, 1)
        })

        test('can perform MIN/MAX aggregation', async () => {
          const result = await prisma.order.aggregate({
            _min: { price: true },
            _max: { price: true },
          })
          expect(result._min.price?.toString()).toBe('-1234.56')
          expect(result._max.price?.toString()).toBe('50000')
        })

        test('can perform COUNT aggregation', async () => {
          const count = await prisma.order.count()
          expect(count).toBe(5)
        })

        test('can perform filtered aggregation', async () => {
          const result = await prisma.order.aggregate({
            _sum: { price: true },
            _count: true,
            where: { price: { gte: '1000' } },
          })
          expect(result._count).toBe(2)
          expect(Number(result._sum.price)).toBeCloseTo(51234.56, 1)
        })
      })

      describe('ambiguous separator cases', () => {
        test('handles 1,234 as thousands separator', async () => {
          const order = await prisma.order.create({ data: { price: '1234' } })
          const found = await prisma.order.findUnique({ where: { id: order.id } })
          expect(found?.price.toString()).toBe('1234')
        })

        test('handles 1,23 as decimal separator', async () => {
          const order = await prisma.order.create({ data: { price: '1.23' } })
          const found = await prisma.order.findUnique({ where: { id: order.id } })
          expect(found?.price.toString()).toBe('1.23')
        })

        test('handles 0.001 correctly (special case)', async () => {
          const order = await prisma.order.create({ data: { price: '0.001' } })
          const found = await prisma.order.findUnique({ where: { id: order.id } })
          // PostgreSQL money type rounds to 2 decimal places
          expect(found?.price.toString()).toBe('0')
        })
      })

      describe('malformed input handling', () => {
        test('handles consecutive separators gracefully', async () => {
          const result = await prisma.$queryRaw<QueryResult>`SELECT '1234.56'::money as price`
          expect(result[0].price).toBe('1234.56')
        })

        test('handles spaces in formatted numbers', async () => {
          const order = await prisma.order.create({ data: { price: '1234567.89' } })
          const found = await prisma.order.findUnique({ where: { id: order.id } })
          expect(found?.price.toString()).toBe('1234567.89')
        })
      })

      describe('raw queries with formatted values', () => {
        test('can query with formatted money values', async () => {
          await prisma.order.create({ data: { price: '50000.00' } })

          const result = await prisma.$queryRaw<QueryResult>`
            SELECT * FROM "Order" WHERE price = '50000.00'::money
          `
          expect(result.length).toBe(1)
          expect(result[0].price).toBe('50000')
        })

        test('can perform aggregation in raw query', async () => {
          await prisma.order.createMany({
            data: [{ price: '100.00' }, { price: '200.00' }, { price: '300.00' }],
          })

          const result = await prisma.$queryRaw<SumResult>`
            SELECT SUM(price)::numeric as total FROM "Order"
          `
          expect(Number(result[0].total)).toBe(600)
        })
      })
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'Testing PostgreSQL-specific money type behavior',
    },
  },
)
