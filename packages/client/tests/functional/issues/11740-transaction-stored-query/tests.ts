import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for #11740 & comment
 * Stored queries in variables for batched tx
 */
testMatrix.setupTestSuite(
  () => {
    testIf(process.env.PRISMA_CLIENT_ENGINE_TYPE !== 'binary')(
      'stored query triggered twice should fail but not exit process',
      async () => {
        const query = prisma.resource.create({ data: { email: 'john@prisma.io' } })

        const result = prisma.$transaction([query, query])

        await expect(result).rejects.toMatchPrismaErrorSnapshot()
      },
    )

    testIf(process.env.PRISMA_CLIENT_ENGINE_TYPE !== 'binary')(
      'stored query trigger .requestTransaction twice should fail',
      async () => {
        const query = prisma.resource.create({ data: { email: 'john@prisma.io' } })

        const fn = async () => {
          await (query as any).requestTransaction({ kind: 'batch' })
          await (query as any).requestTransaction({ kind: 'batch' })
        }

        await expect(fn()).rejects.toMatchPrismaErrorSnapshot()
      },
    )

    testIf(process.env.PRISMA_CLIENT_ENGINE_TYPE !== 'binary')('no multiple resolves should happen', async () => {
      const mockMultipleResolve = jest.fn()

      process.on('multipleResolves', mockMultipleResolve)

      const query = prisma.resource.create({ data: { email: 'john@prisma.io' } })

      const result = prisma.$transaction([query, query])

      await expect(result).rejects.toThrow()

      expect(mockMultipleResolve).toHaveBeenCalledTimes(0)
    })
  },
  {
    skipDataProxy: {
      runtimes: ['edge'],
      reason: 'Skipped because of the error snapshots on edge client',
    },
  },
)
