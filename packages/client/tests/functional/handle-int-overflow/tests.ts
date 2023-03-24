import { getQueryEngineProtocol } from '@prisma/internals'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  testIf(getQueryEngineProtocol() !== 'json')('integer overflow', async () => {
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
    ).rejects.toThrow(/Unable to fit value [\d\.e\+]+ into a 64-bit signed integer for field `int`/)
  })
})
