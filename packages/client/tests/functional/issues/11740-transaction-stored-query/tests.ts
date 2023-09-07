import { ProviderFlavors } from '../../_utils/providerFlavors'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for #11740 & comment
 * Stored queries in variables for batched tx
 */
testMatrix.setupTestSuite(
  ({ providerFlavor }, _, clientMeta) => {
    testIf(process.env.PRISMA_CLIENT_ENGINE_TYPE !== 'binary')(
      'stored query triggered twice should fail but not exit process',
      async () => {
        const query = prisma.resource.create({ data: { email: 'john@prisma.io' } })

        const result = prisma.$transaction([query, query])

        if (providerFlavor === ProviderFlavors.PG) {
          if (clientMeta.dataProxy) {
            await expect(result).rejects.toThrow('Unique constraint failed on the fields: (`email`)')
          } else {
            await expect(result).rejects.toThrow(`duplicate key value violates unique constraint "Resource_email_key"`)
          }
        } else if (providerFlavor === ProviderFlavors.JS_PLANETSCALE) {
          if (clientMeta.dataProxy) {
            await expect(result).rejects.toThrow('Unique constraint failed on the (not available)')
          } else {
            // Full error has a random id so we can't snapshot it completely
            await expect(result).rejects.toThrow(
              `code = AlreadyExists desc = Duplicate entry \'john@prisma.io\' for key \'Resource.Resource_email_key\' (errno 1062) (sqlstate 23000)`,
            )
          }
        } else {
          await expect(result).rejects.toMatchPrismaErrorSnapshot()
        }
      },
    )

    testIf(process.env.PRISMA_CLIENT_ENGINE_TYPE !== 'binary')(
      'stored query trigger .requestTransaction twice should fail',
      async () => {
        const query = prisma.resource.create({ data: { email: 'john@prisma.io' } })

        const fn = async () => {
          await (query as any).requestTransaction({ kind: 'batch', lock: Promise.resolve() })
          await (query as any).requestTransaction({ kind: 'batch', lock: Promise.resolve() })
        }

        if (providerFlavor === ProviderFlavors.PG) {
          if (clientMeta.dataProxy) {
            await expect(fn()).rejects.toThrow('Unique constraint failed on the fields: (`email`)')
          } else {
            await expect(fn()).rejects.toThrow(`duplicate key value violates unique constraint "Resource_email_key"`)
          }
        } else if (providerFlavor === ProviderFlavors.JS_PLANETSCALE) {
          if (clientMeta.dataProxy) {
            await expect(fn()).rejects.toThrow('Unique constraint failed on the (not available)')
          } else {
            // Full error has a random id so we can't snapshot it completely
            await expect(fn()).rejects.toThrow(
              `code = AlreadyExists desc = Duplicate entry 'john@prisma.io' for key 'Resource.Resource_email_key' (errno 1062) (sqlstate 23000)`,
            )
          }
        } else {
          await expect(fn()).rejects.toMatchPrismaErrorSnapshot()
        }
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
