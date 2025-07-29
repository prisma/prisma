import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('integer overflow', async () => {
    await expect(
      prisma.entry.create({
        data: {
          int: 1e20,
        },
      }),
    ).rejects.toThrow(/Unable to fit value 100000000000000000000 into a 64-bit signed integer for field `int`/)
  })

  test('big float in exponent notation', async () => {
    await expect(
      prisma.entry.create({
        data: {
          int: Number.MAX_VALUE,
        },
      }),
    ).rejects.toThrow(/Unable to fit value [\d\.e\+]+ into a 64-bit signed integer for field `int`/)
  })
})
