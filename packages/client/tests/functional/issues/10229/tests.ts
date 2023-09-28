import type { PrismaClientInitializationError } from '../../../../src/runtime/core/errors/PrismaClientInitializationError'
import { ProviderFlavors } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/10229
testMatrix.setupTestSuite(
  ({ providerFlavor }) => {
    // TODO Expected two assertions to be called but received zero assertion calls (no error thrown).
    $test({
      failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON,
    })('should assert that the error has the correct errorCode', async () => {
      let e: PrismaClientInitializationError | undefined
      try {
        await prisma.$connect()
      } catch (error) {
        e = error
      } finally {
        prisma.$disconnect().catch(() => {})
      }

      expect(e?.constructor.name).toEqual('PrismaClientInitializationError')
      expect(e?.errorCode).toEqual('P1001')
    })
  },
  {
    skipDb: true,
    optOut: {
      from: ['sqlite', 'mongodb', 'sqlserver'],
      reason: `
        sqlite: dont have a connection string'
        mongodb: times out and dont throw
        sqlserver: returns undefined
      `,
    },
    skipDataProxy: {
      runtimes: ['node', 'edge'],
      reason: 'InvalidDatasourceError is not compatible with asserted error // Change in Prisma 6',
    },
  },
)
