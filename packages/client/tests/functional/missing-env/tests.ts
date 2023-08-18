import stripAnsi from 'strip-ansi'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta, clientMeta) => {
    test('PrismaClientInitializationError for missing env', async () => {
      const prisma = newPrismaClient()

      try {
        await prisma.$connect()
      } catch (e) {
        const message = stripAnsi(e.message as string)
        expect(e).toBeInstanceOf(Prisma.PrismaClientInitializationError)
        expect(message).toContain('error: Environment variable not found: DATABASE_URI.')
      }
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
          expect(message).toMatchInlineSnapshot(`
                      error: Environment variable not found: DATABASE_URI.
                      Only \`process.env\` and \`globalThis\` can be read, but not \`.env\`.

                      To solve this, provide it directly: https://pris.ly/d/datasource-url
                  `)
        }
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
  },
)
