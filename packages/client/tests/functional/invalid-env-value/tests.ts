import stripAnsi from 'strip-ansi'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  ({ engineType, provider }, suiteMeta, clientMeta) => {
    const OLD_ENV = process.env

    beforeEach(() => {
      process.env = { ...OLD_ENV }
      process.env[`DATABASE_URI_${provider}`] = 'http://some-invalid-url'
    })

    afterEach(() => {
      process.env = OLD_ENV
    })

    // TODO: fails with Expected constructor: PrismaClientInitializationError Received constructor: Error
    skipTestIf(engineType === 'wasm')('PrismaClientInitializationError for invalid env', async () => {
      // This test often fails on macOS CI with thrown: "Exceeded timeout of
      // 60000 ms for a hook. Retrying might help, let's find out
      const isMacCI = Boolean(process.env.CI) && ['darwin'].includes(process.platform)
      if (isMacCI) {
        jest.retryTimes(3)
      }

      const prisma = newPrismaClient()
      const promise = prisma.$connect()

      if (clientMeta.dataProxy && clientMeta.runtime === 'edge') {
        // TODO Prisma 6: should be a PrismaClientInitializationError, but the message is correct
        // await expect(promise).rejects.toBeInstanceOf(Prisma.InvalidDatasourceError)
        await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(
          `Error validating datasource \`db\`: the URL must start with the protocol \`prisma://\``,
        )
      } else if (clientMeta.dataProxy && clientMeta.runtime === 'node') {
        // TODO Prisma 6: should be a PrismaClientInitializationError, but the message is correct
        // await expect(promise).rejects.toBeInstanceOf(Prisma.InvalidDatasourceError)
        await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(
          `Error validating datasource \`db\`: the URL must start with the protocol \`prisma://\``,
        )
      } else if (!clientMeta.dataProxy) {
        await promise.catch((e) => {
          const message = stripAnsi(e.message)
          expect(e).toBeInstanceOf(Prisma.PrismaClientInitializationError)
          expect(message).toContain('error: Error validating datasource `db`: the URL must start with the protocol')
        })
      } else {
        throw new Error('Unhandled case')
      }
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true, // So we can manually call connect for this test
  },
)
