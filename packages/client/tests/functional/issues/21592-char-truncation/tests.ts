// @ts-ignore
import testMatrix from './_matrix'
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.thing.create({
        data: {
          serialNumber: '12345',
          amount: 0,
        },
      })
    })

    test('does not truncate the input', async () => {
      const result = await prisma.thing.findFirstOrThrow()
      expect(result.serialNumber).toBe('12345')
    })

    test('upsert', async () => {
      const result = await prisma.thing.upsert({
        where: { serialNumber: '12345' },
        update: { amount: 1 },
        create: { serialNumber: '12345', amount: 10 },
      })
      expect(result).toEqual({
        id: expect.any(String),
        serialNumber: '12345',
        amount: 1,
      })
    })
  },
  {
    optOut: {
      from: ['mongodb', 'sqlite'],
      reason: '@db.Char is not supported on mongo',
    },
  },
)
