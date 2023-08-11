import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let Prisma: typeof PrismaNamespace
declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    const decimal1 = '1.2'
    const decimal2 = '2.4'

    beforeAll(async () => {
      await prisma.resource.create({
        data: { decimal: decimal1 },
      })
      await prisma.resource.create({
        data: { decimal: decimal2 },
      })
    })

    test.skip('findUnique decimal with Promise.all', async () => {
      const result = await Promise.all([
        prisma.resource.findUnique({
          where: { decimal: decimal1 },
          select: { decimal: true },
        }),
        prisma.resource.findUnique({
          where: { decimal: decimal2 },
          select: { decimal: true },
        }),
      ])

      expect(result).toMatchObject([
        { decimal: new Prisma.Decimal(decimal1) },
        { decimal: new Prisma.Decimal(decimal2) },
      ])
    })

    test.skip('findUnique decimal with $transaction([...])', async () => {
      const result = await prisma.$transaction([
        prisma.resource.findUnique({
          where: { decimal: decimal1 },
          select: { decimal: true },
        }),
        prisma.resource.findUnique({
          where: { decimal: decimal2 },
          select: { decimal: true },
        }),
      ])

      expect(result).toMatchObject([
        { decimal: new Prisma.Decimal(decimal1) },
        { decimal: new Prisma.Decimal(decimal2) },
      ])
    })

    test('findFirst decimal with Promise.all', async () => {
      const result = await Promise.all([
        prisma.resource.findFirst({
          where: { decimal: decimal1 },
          select: { decimal: true },
        }),
        prisma.resource.findFirst({
          where: { decimal: decimal2 },
          select: { decimal: true },
        }),
      ])

      expect(result).toMatchObject([
        { decimal: new Prisma.Decimal(decimal1) },
        { decimal: new Prisma.Decimal(decimal2) },
      ])
    })

    test('findFirst decimal with $transaction([...])', async () => {
      const result = await prisma.$transaction([
        prisma.resource.findFirst({
          where: { decimal: decimal1 },
          select: { decimal: true },
        }),
        prisma.resource.findFirst({
          where: { decimal: decimal2 },
          select: { decimal: true },
        }),
      ])

      expect(result).toMatchObject([
        { decimal: new Prisma.Decimal(decimal1) },
        { decimal: new Prisma.Decimal(decimal2) },
      ])
    })
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: 'MongoDB does not support decimal',
    },
  },
)
