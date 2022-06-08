import testMatrix from './_matrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(() => {
  test('integer overflow', async () => {
    await expect(
      prisma.entry.create({
        data: {
          int: 1e20,
        },
      }),
    ).rejects.toThrowError(
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
    ).rejects.toThrowError(
      /Unable to fit float value \(or large JS integer serialized in exponent notation\) '\d+' into a 64 Bit signed integer for field 'int'. If you're trying to store large integers, consider using `BigInt`./,
    )
  })
})
