import stripAnsi from 'strip-ansi'

import type { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  ({ driverAdapter }, _suiteMeta, clientMeta) => {
    describeIf(driverAdapter === undefined)('default case: no Driver Adapter', () => {
      test('PrismaClientInitializationError for missing env', async () => {
        const prisma = newPrismaClient()

        try {
          await prisma.$connect()
        } catch (e) {
          const message = stripAnsi(e.message as string)
          expect(e).toBeInstanceOf(Prisma.PrismaClientInitializationError)
          expect(message).toContain('error: Environment variable not found: DATABASE_URI.')
        }

        expect.hasAssertions()
      })

      test('PrismaClientInitializationError for missing env and empty override', async () => {
        const prisma = newPrismaClient({
          datasources: {
            db: {},
          },
        })

        try {
          await prisma.$connect()
        } catch (e) {
          const message = stripAnsi(e.message as string)
          expect(e).toBeInstanceOf(Prisma.PrismaClientInitializationError)
          expect(message).toContain('error: Environment variable not found: DATABASE_URI.')
        }

        expect.hasAssertions()
      })

      testIf(clientMeta.dataProxy && clientMeta.runtime === 'edge')(
        'PrismaClientInitializationError for missing env on edge',
        async () => {
          const prisma = newPrismaClient()

          try {
            await prisma.$connect()
          } catch (e) {
            const message = stripAnsi(e.message as string)
            expect(e).toBeInstanceOf(Prisma.PrismaClientInitializationError)
            expect(message).toMatchInlineSnapshot(`"error: Environment variable not found: DATABASE_URI."`)
          }

          expect.hasAssertions()
        },
      )

      testIf(clientMeta.dataProxy && clientMeta.runtime === 'edge')(
        'PrismaClientInitializationError for missing env on edge on cloudflare',
        async () => {
          globalThis.navigator = { userAgent: 'Cloudflare-Workers' }

          const prisma = newPrismaClient()

          try {
            await prisma.$connect()
          } catch (e) {
            const message = stripAnsi(e.message as string)
            expect(e).toBeInstanceOf(Prisma.PrismaClientInitializationError)
            expect(message).toMatchInlineSnapshot(`
              "error: Environment variable not found: DATABASE_URI.

              In Cloudflare module Workers, environment variables are available only in the Worker's \`env\` parameter of \`fetch\`.
              To solve this, provide the connection string directly: https://pris.ly/d/cloudflare-datasource-url"
            `)
          }

          expect.hasAssertions()
          globalThis.navigator = undefined
        },
      )

      testIf(clientMeta.dataProxy && clientMeta.runtime === 'node')(
        'PrismaClientInitializationError for missing env with --no-engine on node',
        async () => {
          const prisma = newPrismaClient()

          try {
            await prisma.$connect()
          } catch (e) {
            const message = stripAnsi(e.message as string)
            expect(e).toBeInstanceOf(Prisma.PrismaClientInitializationError)
            expect(message).toMatchInlineSnapshot(`"error: Environment variable not found: DATABASE_URI."`)
          }

          expect.hasAssertions()
        },
      )
    })

    describeIf(driverAdapter !== undefined)('with Driver Adapters', () => {
      test('Initialisation works even when missing env var referenced in the schema', async () => {
        const prisma = newPrismaClient()
        await prisma.$connect()
      })

      test('PrismaClientInitializationError for missing env and empty override', () => {
        try {
          newPrismaClient({
            datasources: {
              db: {},
            },
          })
        } catch (e) {
          const message = stripAnsi(e.message as string)
          expect(e).toBeInstanceOf(Prisma.PrismaClientInitializationError)
          expect(message).toMatchInlineSnapshot(
            `"Custom datasource configuration is not compatible with Prisma Driver Adapters. Please define the database connection string directly in the Driver Adapter configuration."`,
          )
        }

        expect.hasAssertions()
      })
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
    skipEngine: {
      from: ['binary'],
      reason: 'TODO: fails with timeout on CI: https://github.com/prisma/team-orm/issues/638',
    },
  },
)
