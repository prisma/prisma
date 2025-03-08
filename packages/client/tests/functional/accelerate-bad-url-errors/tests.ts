import type { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  (suiteConfig, _suiteMeta, clientMeta) => {
    const OLD_ENV = { ...process.env }

    afterEach(() => {
      process.env = OLD_ENV
    })

    testIf(clientMeta.dataProxy)('url starts with invalid://', async () => {
      process.env[`DATABASE_URI_${suiteConfig.provider}`] = 'invalid://invalid'

      const prisma = newPrismaClient()

      await expect(prisma.user.findMany()).rejects.toThrow(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        expect.objectContaining({
          message: expect.stringContaining(
            'Error validating datasource `db`: the URL must start with the protocol `prisma://`',
          ),
        }),
      )
    })

    testIf(clientMeta.dataProxy)('url starts with prisma:// but is invalid', async () => {
      process.env[`DATABASE_URI_${suiteConfig.provider}`] = 'prisma://invalid'

      const prisma = newPrismaClient()

      await expect(prisma.user.findMany()).rejects.toThrow(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        expect.objectContaining({
          message: expect.stringContaining('Error validating datasource `db`: the URL must contain a valid API key'),
        }),
      )
    })

    testIf(clientMeta.dataProxy)('url starts with prisma:// with nothing else', async () => {
      process.env[`DATABASE_URI_${suiteConfig.provider}`] = 'prisma://'

      const prisma = newPrismaClient()

      await expect(prisma.user.findMany()).rejects.toThrow(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        expect.objectContaining({
          message: expect.stringContaining('Error validating datasource `db`: the URL must contain a valid API key'),
        }),
      )
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
  },
)
