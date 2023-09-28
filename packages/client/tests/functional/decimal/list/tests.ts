// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import { ProviderFlavors } from '../../_utils/providers'
import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  ({ providerFlavor }) => {
    // TODO scalar lists, don't work yet. Error: Unsupported column type: 1231 - tracked in https://github.com/prisma/team-orm/issues/374
    $test({ failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON })(
      'with decimal instances',
      async () => {
        await prisma.user.create({
          data: {
            decimals: [12.3, 45.6],
          },
        })
      },
    )

    // TODO scalar lists, don't work yet. Error: Unsupported column type: 1231 - tracked in https://github.com/prisma/team-orm/issues/374
    $test({ failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON })(
      'with numbers',
      async () => {
        await prisma.user.create({
          data: {
            decimals: [12.3, 45.6],
          },
        })
      },
    )

    // TODO scalar lists, don't work yet. Error: Unsupported column type: 1231 - tracked in https://github.com/prisma/team-orm/issues/374
    $test({ failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON })(
      'create with strings',
      async () => {
        await prisma.user.create({
          data: {
            decimals: ['12.3', '45.6'],
          },
        })
      },
    )
  },
  {
    optOut: {
      from: ['mongodb', 'mysql', 'sqlite', 'sqlserver'],
      reason: `
        mongodb: connector does not support the Decimal type. 
        mysql & sqlite: connectors do not support lists of primitive types.
        sqlserver: Field "decimals" in model "User" can't be a list. The current connector does not support lists of primitive types.
      `,
    },
  },
)
