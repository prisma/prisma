import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('extended extension functions normally', async () => {
    // TODO: new syntax
    const xprisma = prisma.$extends({ type: 'User' })
    expect(xprisma).not.toBe(prisma)

    expect(await xprisma.user.findMany()).toEqual([])
  })
})
