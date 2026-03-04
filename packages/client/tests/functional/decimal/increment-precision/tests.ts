import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

// Reproduces https://github.com/prisma/prisma/issues/29160
testMatrix.setupTestSuite(
  () => {
    test('increment preserves precision for large Decimal values', async () => {
      const created = await prisma.account.create({
        data: {
          amount: new Prisma.Decimal('0'),
        },
      })

      const afterDeposit = await prisma.account.update({
        where: { id: created.id },
        data: {
          amount: { increment: new Prisma.Decimal('5000000000000000000000000000') },
        },
      })
      expect(afterDeposit.amount.toFixed()).toBe('5000000000000000000000000000')

      const afterWithdrawal1 = await prisma.account.update({
        where: { id: created.id },
        data: {
          amount: { decrement: new Prisma.Decimal('1000000000000000000000') },
        },
      })
      expect(afterWithdrawal1.amount.toFixed()).toBe('4999999000000000000000000000')

      const afterWithdrawal2 = await prisma.account.update({
        where: { id: created.id },
        data: {
          amount: { decrement: new Prisma.Decimal('1000000000000000000000') },
        },
      })
      expect(afterWithdrawal2.amount.toFixed()).toBe('4999998000000000000000000000')

      const afterWithdrawal3 = await prisma.account.update({
        where: { id: created.id },
        data: {
          amount: { decrement: new Prisma.Decimal('1000000000000000000000') },
        },
      })
      expect(afterWithdrawal3.amount.toFixed()).toBe('4999997000000000000000000000')
    })

    test('multiply preserves precision for large Decimal values', async () => {
      const created = await prisma.account.create({
        data: {
          amount: new Prisma.Decimal('1000000000000000000'),
        },
      })

      const afterMultiply = await prisma.account.update({
        where: { id: created.id },
        data: {
          amount: { multiply: new Prisma.Decimal('1000000000') },
        },
      })
      expect(afterMultiply.amount.toFixed()).toBe('1000000000000000000000000000')
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mongodb'],
      reason: 'sqlite uses floating point, mongodb does not support Decimal',
    },
  },
)
