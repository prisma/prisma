import { stripVTControlCharacters } from 'node:util'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ provider }, _suiteMeta, clientMeta) => {
    const OLD_ENV = process.env

    beforeEach(() => {
      process.env = { ...OLD_ENV }
      process.env[`DATABASE_URI_${provider}`] = 'http://some-invalid-url'
    })

    afterEach(() => {
      process.env = OLD_ENV
    })

    test('PrismaClientInitializationError for invalid env', async () => {
      // This test often fails on macOS CI with thrown: "Exceeded timeout of
      // 60000 ms for a hook. Retrying might help, let's find out
      const isMacCI = Boolean(process.env.CI) && ['darwin'].includes(process.platform)
      if (isMacCI) {
        jest.retryTimes(3)
      }

      const prisma = newPrismaClient()
      const promise = prisma.$connect()

      if (!clientMeta.dataProxy) {
        await promise.catch((e) => {
          const message = stripVTControlCharacters(e.message)
          expect(e.name).toEqual('PrismaClientInitializationError')
          expect(message).toContain('Error validating datasource `db`: the URL must start with the protocol')
        })
      } else if (['edge', 'node', 'wasm-engine-edge'].includes(clientMeta.runtime)) {
        await promise.catch((e) => {
          const message = stripVTControlCharacters(e.message)
          expect(e.name).toEqual('InvalidDatasourceError')
          expect(message).toContain(
            'Error validating datasource `db`: the URL must start with the protocol `prisma://`',
          )
        })
      } else {
        throw new Error('Unhandled case')
      }
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true, // So we can manually call connect for this test
    skip(when, { clientEngineExecutor }) {
      when(
        clientEngineExecutor === 'remote',
        `
        When using client engine, since the URL won't be a valid Accelerate URL,
        we will take the local executor code path and will show an error about
        the missing driver adapter instead, which is not what this test is about.
        `,
      )
    },
  },
)
