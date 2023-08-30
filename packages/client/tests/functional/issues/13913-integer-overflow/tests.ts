import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('int overflow', async () => {
    const promise = prisma.resource.create({
      data: {
        number: 2265000000,
      },
    })

    // TODO: stack trace is not able to locate this error via dataproxy
    if (!process.env.TEST_DATA_PROXY) {
      await expect(promise).rejects.toMatchPrismaErrorInlineSnapshot(`

        Invalid \`prisma.resource.create()\` invocation in
        /client/tests/functional/issues/13913-integer-overflow/tests.ts:0:0

          XX 
          XX testMatrix.setupTestSuite(() => {
          XX   test('int overflow', async () => {
        → XX     const promise = prisma.resource.create(
        Error occurred during query execution:
        ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(Error { kind: ToSql(1), cause: Some(Error { kind: ConversionError("Unable to fit integer value '2265000000' into an INT4 (32-bit signed integer)."), original_code: None, original_message: None }) }), transient: false })
      `)
    }
  })
})
