import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('attempt to use $extend causes compile and runtime error', () => {
    expect(() => {
      // @ts-expect-error
      prisma.$extends({})
    }).toThrowErrorMatchingInlineSnapshot(
      `Extensions are not yet generally available, please add \`clientExtensions\` to the \`previewFeatures\` field in the \`generator\` block in the \`schema.prisma\` file.`,
    )
  })
})
