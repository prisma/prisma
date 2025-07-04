import { randomBytes } from 'crypto'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    const bytes1 = new Uint8Array(randomBytes(16))
    const bytes2 = new Uint8Array(randomBytes(16))

    beforeAll(async () => {
      await prisma.resource.createMany({
        data: [{ bytes: bytes1 }, { bytes: bytes2 }],
      })
    })

    test('findUnique bytes with Promise.all', async () => {
      const result = await Promise.all([
        prisma.resource.findUnique({
          where: { bytes: bytes1 },
          select: { bytes: true },
        }),
        prisma.resource.findUnique({
          where: { bytes: bytes2 },
          select: { bytes: true },
        }),
      ])

      expect(result).toMatchObject([{ bytes: bytes1 }, { bytes: bytes2 }])
    })

    test('findUnique bytes with $transaction([...])', async () => {
      const result = await prisma.$transaction([
        prisma.resource.findUnique({
          where: { bytes: bytes1 },
          select: { bytes: true },
        }),
        prisma.resource.findUnique({
          where: { bytes: bytes2 },
          select: { bytes: true },
        }),
      ])

      expect(result).toMatchObject([{ bytes: bytes1 }, { bytes: bytes2 }])
    })

    test('findFirst bytes with Promise.all', async () => {
      const result = await Promise.all([
        prisma.resource.findFirst({
          where: { bytes: bytes1 },
          select: { bytes: true },
        }),
        prisma.resource.findFirst({
          where: { bytes: bytes2 },
          select: { bytes: true },
        }),
      ])

      expect(result).toMatchObject([{ bytes: bytes1 }, { bytes: bytes2 }])
    })

    test('findFirst bytes with $transaction([...])', async () => {
      const result = await prisma.$transaction([
        prisma.resource.findFirst({
          where: { bytes: bytes1 },
          select: { bytes: true },
        }),
        prisma.resource.findFirst({
          where: { bytes: bytes2 },
          select: { bytes: true },
        }),
      ])

      expect(result).toMatchObject([{ bytes: bytes1 }, { bytes: bytes2 }])
    })
  },
  {
    optOut: {
      from: ['sqlserver'],
      reason: 'SQL Server does not support bytes IDs',
    },
  },
)
