import stripAnsi from 'strip-ansi'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  ({ engineType }, suiteMeta, clientMeta) => {
    // TODO: Fails with Expected PrismaClientInitError, Received Error
    skipTestIf(engineType === 'wasm')('PrismaClientInitializationError for missing env', async () => {
      const prisma = newPrismaClient()

      try {
        await prisma.$connect()
      } catch (e) {
        const message = stripAnsi(e.message as string)
        expect(e).toBeInstanceOf(Prisma.PrismaClientInitializationError)
        expect(message).toContain('error: Environment variable not found: DATABASE_URI.')
      }
    })
    // TODO: Fails with Expected PrismaClientInitError, Received Error
    skipTestIf(engineType === 'wasm')(
      'PrismaClientInitializationError for missing env and empty override',
      async () => {
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
      },
    )

    testIf(clientMeta.dataProxy && clientMeta.runtime === 'edge')(
      'PrismaClientInitializationError for missing env on edge',
      async () => {
        const prisma = newPrismaClient()

        try {
          await prisma.$connect()
        } catch (e) {
          const message = stripAnsi(e.message as string)
          expect(e).toBeInstanceOf(Prisma.PrismaClientInitializationError)
          expect(message).toMatchInlineSnapshot(`error: Environment variable not found: DATABASE_URI.`)
        }
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
            error: Environment variable not found: DATABASE_URI.

            In Cloudflare module Workers, environment variables are available only in the Worker's \`env\` parameter of \`fetch\`.
            To solve this, provide the connection string directly: https://pris.ly/d/cloudflare-datasource-url
          `)
        }

        delete globalThis.navigator
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
          expect(message).toMatchInlineSnapshot(`error: Environment variable not found: DATABASE_URI.`)
        }
      },
    )
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
