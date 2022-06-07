import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(() => {
  test('attempt to use $metrics a compile-time error', () => {
    // TODO: this is always an error in the editor. Maybe we need to generate
    // schema-dependent client types somehow
    expectTypeOf(prisma).not.toHaveProperty('$metrics')
  })

  test('attempt to use $metrics a run-time error', () => {
    expect(() => (prisma as any).$metrics).toThrowErrorMatchingInlineSnapshot(
      `\`metrics\` preview feature must be enabled in order to access metrics API`,
    )
  })
})
