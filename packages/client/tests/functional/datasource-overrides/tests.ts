import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import type { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ provider, driverAdapter }, _suiteMeta, clientMeta) => {
    let dbURL: string
    beforeAll(() => {
      dbURL = process.env[`DATABASE_URI_${provider}`]!
      process.env[`DATABASE_URI_${provider}`] = 'invalid://url'
    })

    afterAll(() => {
      process.env[`DATABASE_URI_${provider}`] = dbURL
    })

    describeIf(driverAdapter === undefined)('default case: no Driver Adapter', () => {
      test('verify that connect fails without override', async () => {
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
    })

    describeIf(driverAdapter === 'js_pg')('custom datasource should not be used with driver adapter', () => {
      const pool = new Pool({
        connectionString: dbURL,
      })

      const adapter = new PrismaPg(pool)

      test('throws when both `datasourceUrl` and `adapter` are used at the same time', () => {
        expect(() => {
          newPrismaClient({
            adapter,
            datasourceUrl: dbURL,
          })
        }).toThrow(
          'Custom datasource configuration is not compatible with Prisma Driver Adapters. Please define the database connection string directly in the Driver Adapter configuration.',
        )
      })

      test('throws when both `datasources` and `adapter` are used at the same time', () => {
        expect(() => {
          newPrismaClient({
            adapter,
            datasources: {
              db: { url: dbURL },
            },
          })
        }).toThrow(
          'Custom datasource configuration is not compatible with Prisma Driver Adapters. Please define the database connection string directly in the Driver Adapter configuration.',
        )
      })
    })
  },
  {
    skipDefaultClientInstance: true,
    skipDriverAdapter: {
      from: ['js_planetscale', 'js_neon', 'js_d1', 'js_libsql'],
      reason: 'We only need to check a single driver adapter. We can skip the rest.',
    },
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
