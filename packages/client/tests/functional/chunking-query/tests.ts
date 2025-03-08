import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'
import {
  EXCESS_BIND_VALUES_BY_PROVIDER,
  MAX_BIND_VALUES_BY_PROVIDER,
  RELATION_JOINS_NO_CHUNKING_ERROR_MSG,
} from './_utils'
// @ts-ignore
import type { PrismaClient, Tag } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  ({ provider, driverAdapter }, _suiteMeta, _clientMeta, cliMeta) => {
    const MAX_BIND_VALUES = MAX_BIND_VALUES_BY_PROVIDER[provider]
    const EXCESS_BIND_VALUES = EXCESS_BIND_VALUES_BY_PROVIDER[provider]

    function generatedIds(n: number) {
      // ["1","2",...,"n"]
      const ids = Array.from({ length: n }, (_, i) => i + 1)
      return ids
    }

    const usingRelationJoins = cliMeta.previewFeatures.includes('relationJoins')

    // Chunking is not supported with joins, so the tests for success cases need to be skipped
    describeIf(!usingRelationJoins)('issues #8832 / #9326 success cases', () => {
      async function createTags(n: number): Promise<number[]> {
        const ids = generatedIds(n)
        const data = ids.map((id) => ({ id }))
        await prisma.tag.createMany({
          data,
        })
        return ids
      }

      async function getTagsFindManyInclude(): Promise<Tag[]> {
        const tags = await prisma.tag.findMany({
          include: {
            posts: true,
          },
        })
        return tags
      }

      async function getTagsParams(ids: number[]): Promise<Tag[]> {
        const idsParams = ids.map((paramIdx) => {
          const param = ['mysql'].includes(provider) ? '?' : `\$${paramIdx}`
          return param
        })

        const tags = await prisma.$queryRawUnsafe<Tag[]>(
          `
            SELECT *
            FROM tag
            WHERE id IN (${idsParams.join(', ')})
          `,
          ...ids,
        )
        return tags
      }

      async function getTagsFindManyIn(ids: number[]): Promise<Tag[]> {
        const tags = await prisma.tag.findMany({
          where: {
            id: {
              in: ids,
            },
          },
        })
        return tags
      }

      async function clean() {
        await prisma.$transaction([prisma.tagsOnPosts.deleteMany(), prisma.post.deleteMany(), prisma.tag.deleteMany()])
      }

      afterEach(async () => {
        await clean()
      }, 80_000)

      test('should succeed when "in" has MAX ids', async () => {
        const ids = await createTags(MAX_BIND_VALUES)
        const tags = await getTagsFindManyIn(ids)

        expect(tags.length).toBe(MAX_BIND_VALUES)
      })

      test('should succeed when "include" involves MAX records', async () => {
        await createTags(MAX_BIND_VALUES)
        const tags = await getTagsFindManyInclude()

        expect(tags.length).toBe(MAX_BIND_VALUES)
      })

      test('should succeed when "in" has EXCESS ids', async () => {
        const ids = await createTags(EXCESS_BIND_VALUES)
        const tags = await getTagsFindManyIn(ids)

        expect(tags.length).toBe(EXCESS_BIND_VALUES)
      })

      test('should succeed when "include" involves EXCESS records', async () => {
        await createTags(EXCESS_BIND_VALUES)
        const tags = await getTagsFindManyInclude()

        expect(tags.length).toBe(EXCESS_BIND_VALUES)
      })

      // Chunking mechanism looks flawed with pagination.
      // See https://github.com/prisma/prisma/issues/23733 for more info
      // eslint-disable-next-line jest/no-disabled-tests
      test('should succeed when "in" has EXCESS ids and a "skip" filter', async () => {
        const ids = await createTags(EXCESS_BIND_VALUES)

        const tags = await prisma.tag.findMany({
          where: {
            id: { in: ids },
          },
          skip: 1,
        })

        expect(tags.length).toBe(EXCESS_BIND_VALUES - 1)
      })

      test('should succeed when raw query has MAX ids', async () => {
        const ids = await createTags(MAX_BIND_VALUES)
        const tags = await getTagsParams(ids)

        expect(tags.length).toBe(MAX_BIND_VALUES)
      })

      // Sqlite excluded because it's bind parameter limit is currently incorrect which makes the QE chunk queries enough to not trigger the error.
      testIf(driverAdapter === undefined && provider !== Providers.SQLITE)(
        'should fail when raw query has EXCESS ids',
        async () => {
          const ids = await createTags(EXCESS_BIND_VALUES)

          await expect(getTagsParams(ids)).rejects.toThrow()
        },
      )
    })

    // Sqlite excluded because it's bind parameter limit is currently incorrect which makes the QE chunk queries enough to not trigger the error.
    //
    // See: https://github.com/prisma/prisma/issues/21802.
    // See: https://github.com/prisma/prisma/issues/21803.
    describeIf(provider !== Providers.SQLITE)('chunking logic does not trigger with 2 IN filters', () => {
      function selectWith2InFilters(ids: number[]) {
        return prisma.tag.findMany({
          where: {
            OR: [
              {
                id: { in: ids },
              },
              {
                id: { in: ids },
              },
            ],
          },
        })
      }

      test('Selecting MAX ids at once in two inclusive disjunct filters results in error', async () => {
        const ids = generatedIds(MAX_BIND_VALUES)

        if (driverAdapter === undefined) {
          // When using MAX ids, it fails both with relationJoins and without because the amount of query params that's computed is not beyond the limit.
          // To be clear: the root problem comes from the way the QE computes the amount of query params.
          await expect(selectWith2InFilters(ids)).rejects.toThrow()
        } else {
          // It's unknown why this test doesn't fail with driver adapters.
          await expect(selectWith2InFilters(ids)).resolves.toMatchInlineSnapshot('[]')
        }
      })

      test('Selecting EXCESS ids at once in two inclusive disjunct filters results in error', async () => {
        const ids = generatedIds(EXCESS_BIND_VALUES)

        if (usingRelationJoins) {
          await expect(selectWith2InFilters(ids)).rejects.toThrow(RELATION_JOINS_NO_CHUNKING_ERROR_MSG)
        } else {
          await expect(selectWith2InFilters(ids)).rejects.toThrow()
        }
      })
    })
  },
  {
    optOut: {
      from: ['sqlserver', 'mongodb'],
      reason: 'not relevant for this test.',
    },
    skipDriverAdapter: {
      from: ['js_planetscale', 'js_neon', 'js_d1'],

      // `rpc error: code = Aborted desc = Row count exceeded 10000 (CallerID: userData1)", state: "70100"`
      // This could potentially be configured in Vitess by increasing the `queryserver-config-max-result-size`
      // query server parameter.
      reason:
        'Vitess supports at most 10k rows returned in a single query, so this test is not applicable. Neon occasionally fails with different parameter counts in its error messages. D1 does not have the correct amount of max_bind_values.',
    },
  },
)
