import { ProviderFlavors } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  ({ providerFlavor }) => {
    // TODO Inconsistent column data: Conversion failed: cannot convert 2147483648 to i32: out of range integral type conversion attempted
    skipTestIf(providerFlavor === ProviderFlavors.JS_PLANETSCALE)('upsert should not fail', async () => {
      await prisma.resource.upsert({
        where: {
          id: 2147483647 + 1,
        },
        update: {},
        create: {
          id: 2147483647 + 1,
        },
      })

      await prisma.resource.upsert({
        where: {
          id: 2147483647 + 1,
        },
        update: {},
        create: {
          id: 2147483647 + 1,
        },
      })
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'This issue only happens on MySQL',
    },
  },
)
