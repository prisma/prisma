// @ts-ignore
import { Prisma as PrismaNamespace, PrismaClient } from '@prisma/client'
import { Decimal } from 'decimal.js'

import testMatrix from './_matrix'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  () => {
    describe('possible inputs', () => {
      beforeAll(async () => {
        await prisma.user.create({
          data: { money: new Decimal('12.5') },
        })
      })

      afterAll(async () => {
        await prisma.user.deleteMany()
      })

      test('decimal as Decimal.js instance', async () => {
        const result = await prisma.user.findFirst({
          where: {
            money: new Decimal('12.5'),
          },
        })

        expect(String(result?.money)).toBe('12.5')
      })

      test('decimal as string', async () => {
        const result = await prisma.user.findFirst({
          where: {
            money: '12.5',
          },
        })

        expect(String(result?.money)).toBe('12.5')
      })

      test('decimal as number', async () => {
        const result = await prisma.user.findFirst({
          where: {
            money: { gt: 12.4, lt: 12.6 },
          },
        })

        expect(String(result?.money)).toBe('12.5')
      })

      test('decimal as decimal.js-like object', async () => {
        const result = await prisma.user.findFirst({
          where: {
            money: {
              d: [12, 5000000],
              e: 1,
              s: 1,
            },
          },
        })

        expect(String(result?.money)).toBe('12.5')
      })
    })

    describe('precision', () => {
      afterEach(async () => {
        await prisma.user.deleteMany()
      })

      // https://github.com/prisma/prisma/issues/8160
      test.failing('preserves precision when writing longer numbers to to db', async () => {
        const value = '1.100000000000000000000000000001234'
        await prisma.user.create({
          data: { money: value },
        })

        const user = await prisma.user.findFirst({ where: {} })

        expect(user?.money.toFixed()).toBe(value)
      })

      // https://github.com/prisma/prisma/issues/5925
      test.failing('preserves precision when writing shorter numbers to to db', async () => {
        await prisma.user.create({
          data: { money: new Prisma.Decimal('8.7') },
        })

        const user = await prisma.user.findFirst({ where: {} })

        expect(user?.money.toFixed()).toBe('8.7')
      })

      test('raw Prisma.Decimal preserve precision', () => {
        expect(new Prisma.Decimal('1.100000000000000000000000000001234').toFixed()).toBe(
          '1.100000000000000000000000000001234',
        )
        expect(new Prisma.Decimal('8.7').toFixed()).toBe('8.7')
      })
    })
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: 'Mongodb connector does not support the Decimal type.',
    },
  },
)
