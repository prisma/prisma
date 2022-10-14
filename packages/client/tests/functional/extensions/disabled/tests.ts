import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  test('attempt to use $extend causes compile and runtime error', () => {
    expect(() => {
      // @ts-expect-error
      prisma.$extends({})
    }).toThrowErrorMatchingInlineSnapshot(`Extensions are not yet available`)
  })
})
