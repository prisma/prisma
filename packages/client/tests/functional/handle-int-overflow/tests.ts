import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('integer overflow', async () => {
    await expect(
      prisma.entry.create({
        data: {
          int: 1e20,
        },
      }),
    ).rejects.toThrow(
      /A number used in the query does not fit into a 64 bit signed integer. Consider using `BigInt` as field type if you're trying to store large integers./,
    )
  })

  test('big float in exponent notation', async () => {
    await expect(
      prisma.entry.create({
        data: {
          int: Number.MAX_VALUE,
        },
      }),
    ).rejects.toThrow(
      /Unable to fit float value \(or large JS integer serialized in exponent notation\) '\d+' into a 64 Bit signed integer for field 'int'. If you're trying to store large integers, consider using `BigInt`./,
    )
  })
})
