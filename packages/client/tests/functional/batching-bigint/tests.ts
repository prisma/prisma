import { AdapterProviders } from '../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    const bigint1 = BigInt('354789435768435687')
    const bigint2 = BigInt('873547358945943556')

    beforeAll(async () => {
      await prisma.resource.createMany({
        data: [{ bigint: bigint1 }, { bigint: bigint2 }],
      })
    })

    test('findUnique bigint with Promise.all', async () => {
      const result = await Promise.all([
        prisma.resource.findUnique({
          where: { bigint: bigint1 },
          select: { bigint: true },
        }),
        prisma.resource.findUnique({
          where: { bigint: bigint2 },
          select: { bigint: true },
        }),
      ])

      expect(result).toMatchObject([{ bigint: bigint1 }, { bigint: bigint2 }])
    })

    test('findUnique bigint with $transaction([...])', async () => {
      const result = await prisma.$transaction([
        prisma.resource.findUnique({
          where: { bigint: bigint1 },
          select: { bigint: true },
        }),
        prisma.resource.findUnique({
          where: { bigint: bigint2 },
          select: { bigint: true },
        }),
      ])

      expect(result).toMatchObject([{ bigint: bigint1 }, { bigint: bigint2 }])
    })

    test('findFirst bigint with Promise.all', async () => {
      const result = await Promise.all([
        prisma.resource.findFirst({
          where: { bigint: bigint1 },
          select: { bigint: true },
        }),
        prisma.resource.findFirst({
          where: { bigint: bigint2 },
          select: { bigint: true },
        }),
      ])

      expect(result).toMatchObject([{ bigint: bigint1 }, { bigint: bigint2 }])
    })

    test('findFirst bigint with $transaction([...])', async () => {
      const result = await prisma.$transaction([
        prisma.resource.findFirst({
          where: { bigint: bigint1 },
          select: { bigint: true },
        }),
        prisma.resource.findFirst({
          where: { bigint: bigint2 },
          select: { bigint: true },
        }),
      ])

      expect(result).toMatchObject([{ bigint: bigint1 }, { bigint: bigint2 }])
    })
  },
  {
    skipDriverAdapter: {
      from: [AdapterProviders.JS_D1],
      reason: 'js_d1: Invalid Int value received',
    },
  },
)
