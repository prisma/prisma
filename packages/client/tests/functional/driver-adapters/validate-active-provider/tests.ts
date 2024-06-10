import path from 'node:path'

import type { D1Database } from '@cloudflare/workers-types'
import { Client as PlanetScaleClient } from '@planetscale/database'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaPlanetScale } from '@prisma/adapter-planetscale'
import { Pool } from 'pg'
import { getPlatformProxy } from 'wrangler'

import type { PrismaClientInitializationError } from '../../../../src/runtime/core/errors/PrismaClientInitializationError'
import { Providers } from '../../_utils/providers'
import { type DatasourceInfo } from '../../_utils/setupTestSuiteEnv'
import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let datasourceInfo: DatasourceInfo
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

// https://github.com/prisma/prisma/issues/21864
testMatrix.setupTestSuite(
  ({ driverAdapter, provider }) => {
    testIf(driverAdapter === 'js_pg' && provider === Providers.MYSQL)(
      '@prisma/adapter-pg cannot be used with `provider = "mysql"`',
      () => {
        expect.assertions(2)

        const pool = new Pool({ connectionString: datasourceInfo.databaseUrl })
        const adapter = new PrismaPg(pool)

        try {
          newPrismaClient({
            adapter,
          })
        } catch (error) {
          const e = error as PrismaClientInitializationError
          expect(e.constructor.name).toEqual('PrismaClientInitializationError')
          expect(e.message).toMatchInlineSnapshot(
            `"The Driver Adapter \`@prisma/adapter-pg\`, based on \`postgres\`, is not compatible with the provider \`mysql\` specified in the Prisma schema."`,
          )
        }
      },
    )

    testIf(driverAdapter === 'js_planetscale' && provider === Providers.SQLITE)(
      '@prisma/adapter-planetscale cannot be used with `provider = "sqlite"`',
      () => {
        expect.assertions(2)

        const planetscale = new PlanetScaleClient({ url: datasourceInfo.databaseUrl, fetch })
        const adapter = new PrismaPlanetScale(planetscale)

        try {
          newPrismaClient({
            adapter,
          })
        } catch (error) {
          const e = error as PrismaClientInitializationError
          expect(e.constructor.name).toEqual('PrismaClientInitializationError')
          expect(e.message).toMatchInlineSnapshot(
            `"The Driver Adapter \`@prisma/adapter-planetscale\`, based on \`mysql\`, is not compatible with the provider \`sqlite\` specified in the Prisma schema."`,
          )
        }
      },
    )

    testIf(driverAdapter === 'js_d1' && provider === Providers.POSTGRESQL)(
      '@prisma/adapter-d1 cannot be used with `provider = "postgresql"`',
      async () => {
        expect.assertions(2)

        const { env, dispose } = await getPlatformProxy<{ D1_DATABASE: D1Database }>({
          configPath: path.join(__dirname, './wrangler.toml'),
        })
        const d1Client = env.D1_DATABASE
        const adapter = new PrismaD1(d1Client)

        try {
          newPrismaClient({
            adapter,
          })
        } catch (error) {
          const e = error as PrismaClientInitializationError
          expect(e.constructor.name).toEqual('PrismaClientInitializationError')
          expect(e.message).toMatchInlineSnapshot(
            `"The Driver Adapter \`@prisma/adapter-d1\`, based on \`sqlite\`, is not compatible with the provider \`postgres\` specified in the Prisma schema."`,
          )
        } finally {
          await dispose()
        }
      },
    )
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
    optOut: {
      from: ['cockroachdb', 'mongodb', 'sqlserver'],
      reason: `We don't have Driver Adapters for these databases yet.`,
    },
  },
)
