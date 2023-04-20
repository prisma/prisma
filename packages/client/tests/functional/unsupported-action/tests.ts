import { getQueryEngineProtocol } from '@prisma/internals'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    testIf(getQueryEngineProtocol() === 'graphql')('unsupported method (graphql)', async () => {
      // @ts-expect-error
      const result = prisma.user.aggregateRaw()
      await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`

        Invalid \`prisma.user.aggregateRaw()\` invocation in
        /client/tests/functional/unsupported-action/tests.ts:0:0

          XX () => {
          XX   testIf(getQueryEngineProtocol() === 'graphql')('unsupported method (graphql)', async () => {
          XX     // @ts-expect-error
        → XX     const result = prisma.user.aggregateRaw(
        Model \`User\` does not support \`aggregateRaw\` action.
      `)
    })

    testIf(getQueryEngineProtocol() === 'json')('unsupported method (json)', async () => {
      // @ts-expect-error
      const result = prisma.user.aggregateRaw()
      await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`

                Invalid \`prisma.user.aggregateRaw()\` invocation in
                /client/tests/functional/unsupported-action/tests.ts:0:0

                  XX 
                  XX testIf(getQueryEngineProtocol() === 'json')('unsupported method (json)', async () => {
                  XX   // @ts-expect-error
                → XX   const result = prisma.user.aggregateRaw(
                Operation 'aggregateRaw' for model 'User' does not match any query.
            `)
    })
  },
  {
    skipDataProxy: {
      runtimes: ['edge'],
      reason: 'Error rendering is different for edge client',
    },
    optOut: {
      from: ['mongodb'],
      reason: 'Test uses aggregateRaw as an example of unsupported method for SQL databases, it exists on mongo',
    },
  },
)
