import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  test('example', () => {
    throw new Error('No test defined')
  })
}<%_ if (optedOutProviders.length > 0) { _%>, {
  optOut: {
    from: [
    <%_ for (const provider of optedOutProviders) { _%>
    '<%= provider %>',
    <%_ } _%>
    ],
    reason: '<%= optOutReason %>'
  }
}<%_} _%>)
