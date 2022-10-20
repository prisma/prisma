import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    test('example', async () => {
      const data = Promise.all([
        prisma.user.create({ data: { email: 'john1@doe.io' } }),
        prisma.user.create({ data: { email: 'john2@doe.io' } }),
        prisma.user.create({ data: { email: 'john3@doe.io' } }),
        prisma.user.create({ data: { email: 'john1@doe.io' } }),
      ])

      await expect(data).rejects.toMatchPrismaErrorInlineSnapshot(`

        Invalid \`prisma.user.create()\` invocation in
        /client/tests/functional/issues/15433-wrong-error-query-batch/transaction.ts:0:0

           XX (suiteConfig, suiteMeta) => {
           XX   test('example', async () => {
          XX     const data = Promise.all([
          XX       prisma.user.create({ data: { email: 'john1@doe.io' } }),
          XX       prisma.user.create({ data: { email: 'john2@doe.io' } }),
          XX       prisma.user.create({ data: { email: 'john3@doe.io' } }),
        → XX       prisma.user.create(
        Unique constraint failed on the fields: (\`email\`)
      `)
    })
  },
  {
    optOut: {
      from: ['postgresql', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'this is no something that is dependent on the database',
    },
  },
)
