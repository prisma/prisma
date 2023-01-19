import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('extended extension functions normally', async () => {
    const xprisma = prisma.$extends({})
    expect(xprisma).not.toBe(prisma)

    expectTypeOf(xprisma).not.toHaveProperty('$use')
    expect(await xprisma.user.findMany()).toEqual([])
  })

  test('does not recompute extensions property on every access', () => {
    const xprisma = prisma.$extends({})

    expect((xprisma as any)._extensions).toBe((xprisma as any)._extensions)
  })
})
