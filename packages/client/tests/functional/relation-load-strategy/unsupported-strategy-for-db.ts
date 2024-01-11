import { providersSupportingRelationJoins } from './_common'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

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
            relationLoadStrategy: 'join',
            include: {
              posts: true,
            },
          }),
        ).rejects.toMatchPrismaErrorInlineSnapshot(`

          Invalid \`prisma.user.findMany()\` invocation in
          /client/tests/functional/relation-load-strategy/unsupported-strategy-for-db.ts:0:0

            XX 'using load strategy that is not supported for provider',
            XX async () => {
            XX   await expect(
          → XX     prisma.user.findMany({
                     relationLoadStrategy: "join",
                                           ~~~~~~
                     include: {
                       posts: true
                     }
                   })

          Invalid value for argument \`relationLoadStrategy\`. Expected RelationLoadStrategy.
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
