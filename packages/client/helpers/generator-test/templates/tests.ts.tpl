import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

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
