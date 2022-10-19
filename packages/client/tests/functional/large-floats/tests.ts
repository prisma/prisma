// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('floats', async () => {
    const largeFloat = await prisma.floats.create({
      data: { value: 1e20 },
    })
    const negativeFloat = await prisma.floats.create({
      data: { value: -1e20 },
    })
    const largeInteger = await prisma.floats.create({
      data: { value: Number.MAX_SAFE_INTEGER },
    })
    const negativeInteger = await prisma.floats.create({
      data: { value: Number.MIN_SAFE_INTEGER },
    })
    const otherFloat = await prisma.floats.create({
      data: { value: 13.37 },
    })

    expect(largeFloat.value).toEqual(1e20)
    expect(negativeFloat.value).toEqual(-1e20)
    expect(largeInteger.value).toEqual(Number.MAX_SAFE_INTEGER)
    expect(negativeInteger.value).toEqual(Number.MIN_SAFE_INTEGER)
    expect(otherFloat.value).toEqual(13.37)
  })
})
