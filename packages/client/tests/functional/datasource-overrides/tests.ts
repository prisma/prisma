import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ provider, engineType }, suiteMeta, clientMeta) => {
    let dbURL: string
    beforeAll(() => {
      dbURL = process.env[`DATABASE_URI_${provider}`]!
      process.env[`DATABASE_URI_${provider}`] = 'invalid://url'
    })

    afterAll(() => {
      process.env[`DATABASE_URI_${provider}`] = dbURL
    })

    // TODO: Fails with Expected PrismaClientInitError, Received Error
    skipTestIf(engineType === 'wasm')('verify that connect fails without override', async () => {
      // this a smoke to verify that our beforeAll setup worked correctly and right
      // url won't be picked up by Prisma client anymore.
      // If this test fails, subsequent tests can't be trusted regardless of whether or not they pass or not.

      const prisma = newPrismaClient()
      const expectedError = clientMeta.dataProxy
        ? { name: 'InvalidDatasourceError' }
        : { name: 'PrismaClientInitializationError' }

      await expect(prisma.$connect()).rejects.toMatchObject(expectedError)
    })

    test('does not throw when URL is overriden (long syntax)', async () => {
      const prisma = newPrismaClient({
        datasources: {
          db: { url: dbURL },
        },
      })
      await expect(prisma.$connect()).resolves.not.toThrow()
    })

    test('does not throw when URL is overridden (shortcut)', async () => {
      const prisma = newPrismaClient({
        datasourceUrl: dbURL,
      })
      await expect(prisma.$connect()).resolves.not.toThrow()
    })

    test('throws when both short and long override properties used at the same time', () => {
      expect(() => {
        newPrismaClient({
          datasources: {
            db: { url: dbURL },
          },
          datasourceUrl: dbURL,
        })
      }).toThrow('Can not use "datasourceUrl" and "datasources" options at the same time. Pick one of them')
    })
  },
  {
    skipDefaultClientInstance: true,
    skipDataProxy: {
      runtimes: ['edge'],
      reason: 'Smoke test fails since original env var are embedded into client',
    },
    skipEngine: {
      from: ['binary'],
      reason: 'TODO: fails with timeout on CI: https://github.com/prisma/team-orm/issues/636',
    },
  },
)
