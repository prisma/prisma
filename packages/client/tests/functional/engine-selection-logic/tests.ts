import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ provider }, _suiteMeta, clientMeta) => {
    const OLD_ENV = { ...process.env }
    const restoreEnv = () => {
      for (const key of Object.keys(process.env)) {
        if (!(key in OLD_ENV)) {
          delete process.env[key]
        }
      }

      for (const [key, value] of Object.entries(OLD_ENV)) {
        if (value === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      }
    }

    beforeEach(() => {
      restoreEnv()
    })

    afterAll(() => {
      restoreEnv()
    })

    describe('via env var', () => {
      testIf(clientMeta.dataProxy /** = --no-engine */)(
        '--no-engine prevents from using the other engines',
        async () => {
          process.env[`DATABASE_URI_${provider}`] = 'postgresql://postgres:password@localhost:5432/db'

          const prisma = newPrismaClient()
          const promise = prisma.$connect()

          // proof that the correct engine is used
          await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(
            `"Error validating datasource \`db\`: the URL must start with the protocol \`prisma://\` or \`prisma+postgres://\`"`,
          )
        },
      )
    })

    describe('via url override', () => {
      testIf(clientMeta.dataProxy /** = --no-engine */)(
        '--no-engine prevents from using the other engines',
        async () => {
          const prisma = newPrismaClient({
            datasources: {
              db: {
                url: 'postgresql://postgres:password@localhost:5432/db',
              },
            },
          })
          const promise = prisma.$connect()

          // proof that the correct engine is used
          await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(
            `"Error validating datasource \`db\`: the URL must start with the protocol \`prisma://\` or \`prisma+postgres://\`"`,
          )
        },
      )
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
  },
)
