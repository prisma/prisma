// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import { providersSupportingRelationJoins } from '../relation-load-strategy/_common'
import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig, _suiteMeta, _clientMeta, cliMeta) => {
    const relationJoinsEnabled = cliMeta.previewFeatures.includes('relationJoins')
    const providerSupportsRelationJoins = providersSupportingRelationJoins.includes(suiteConfig.provider)

    testIf(relationJoinsEnabled && !providerSupportsRelationJoins)(
      'using load strategy that is not supported for provider',
      async () => {
        await expect(
          prisma.user.findMany({
            // @ts-expect-error
            relationLoadStrategy: 'query',
            include: {
              posts: true,
            },
          }),
        ).rejects.toMatchPrismaErrorInlineSnapshot(`
          "
          Invalid \`prisma.user.findMany()\` invocation in
          /client/tests/functional/relation-load-strategy-unsupported/unsupported-strategy-for-db.ts:0:0

            XX 'using load strategy that is not supported for provider',
            XX async () => {
            XX   await expect(
          → XX     prisma.user.findMany({
                     relationLoadStrategy: "query",
                     ~~~~~~~~~~~~~~~~~~~~
                     include: {
                       posts: true
                     },
                   ? where?: UserWhereInput,
                   ? orderBy?: UserOrderByWithRelationInput[] | UserOrderByWithRelationInput,
                   ? cursor?: UserWhereUniqueInput,
                   ? take?: Int,
                   ? skip?: Int,
                   ? distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
                   })

          Unknown argument \`relationLoadStrategy\`. Available options are marked with ?."
        `)
      },
    )
  },
  {
    skipDataProxy: {
      runtimes: ['edge'],
      reason: 'Errors are formatted differently in edge client, so snapshots mismatch',
    },
  },
)
