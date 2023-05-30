import { getQueryEngineProtocol } from '@prisma/internals'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    testIf(getQueryEngineProtocol() === 'graphql')('throws on invalid date (graphql)', async () => {
      await expect(
        prisma.user.findMany({
          where: {
            date: new Date('I am not a date'),
          },
        }),
      ).rejects.toMatchPrismaErrorInlineSnapshot(`

        Invalid \`prisma.user.findMany()\` invocation in
        /client/tests/functional/issues/18970-invalid-date/tests.ts:0:0

          XX () => {
          XX   testIf(getQueryEngineProtocol() === 'graphql')('throws on invalid date (graphql)', async () => {
          XX     await expect(
        → XX       prisma.user.findMany({
                     where: {
                       date: new Date('Invalid Date')
                             ~~~~~~~~~~~~~~~~~~~~~~~~
                     }
                   })

        Argument date for where.date is not a valid Date object.


      `)
    })

    testIf(getQueryEngineProtocol() === 'json')('throws on invalid date (json)', async () => {
      await expect(
        prisma.user.findMany({
          where: {
            date: new Date('I am not a date'),
          },
        }),
      ).rejects.toMatchPrismaErrorInlineSnapshot(`

                              Invalid \`prisma.user.findMany()\` invocation in
                              /client/tests/functional/issues/18970-invalid-date/tests.ts:0:0

                                XX 
                                XX testIf(getQueryEngineProtocol() === 'json')('throws on invalid date (json)', async () => {
                                XX   await expect(
                              → XX     prisma.user.findMany({
                                         where: {
                                           date: new Date("Invalid Date")
                                                 ~~~~~~~~~~~~~~~~~~~~~~~~
                                         }
                                       })

                              Invalid value for argument \`date\`: Provided Date object is invalid. Expected Date.
                      `)
    })
  },
  {
    skipDataProxy: {
      runtimes: ['edge'],
      reason: 'Different error rendering for edge client',
    },
  },
)
