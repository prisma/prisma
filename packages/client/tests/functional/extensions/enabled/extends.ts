import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(() => {
  test('extended extension functions normally', async () => {
    const xprisma = prisma.$extends({})
    expect(xprisma).not.toBe(prisma)

    expect(await xprisma.user.findMany()).toEqual([])
  })
})
