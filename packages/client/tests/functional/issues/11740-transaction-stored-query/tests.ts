import { AdapterProviders } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for #11740 & comment
 * Stored queries in variables for batched tx
 */
testMatrix.setupTestSuite(
  ({ driverAdapter, engineType }) => {
    // TODO planetscale cannot snapshot this error because the id cannot be hidden
    testIf(engineType !== 'binary' && driverAdapter !== AdapterProviders.JS_PLANETSCALE)(
      'stored query triggered twice should fail but not exit process',
      async () => {
        const query = prisma.resource.create({
          data: {
            email: 'john@prisma.io',
          },
        })

        const result = prisma.$transaction([query, query])

        await expect(result).rejects.toMatchPrismaErrorSnapshot()
      },
    )

    // TODO planetscale cannot snapshot this error because the id cannot be hidden
    testIf(engineType !== 'binary' && driverAdapter !== AdapterProviders.JS_PLANETSCALE)(
      'stored query trigger .requestTransaction twice should fail',
      async () => {
        const query = prisma.resource.create({
          data: {
            email: 'john@prisma.io',
          },
        })

        const fn = async () => {
          await (query as any).requestTransaction({ kind: 'batch', lock: Promise.resolve() })
          await (query as any).requestTransaction({ kind: 'batch', lock: Promise.resolve() })
        }

        await expect(fn()).rejects.toMatchPrismaErrorSnapshot()
      },
    )

    testIf(engineType !== 'binary')('no multiple resolves should happen', async () => {
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
