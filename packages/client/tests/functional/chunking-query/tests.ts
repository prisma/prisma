import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient, Tag } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  ({ provider, providerFlavor }) => {
    function generatedIds(n: number) {
      // ["1","2",...,"n"]
      const ids = Array.from({ length: n }, (_, i) => i + 1)
      return ids
    }

    describe('issues #8832 / #9326 success cases', () => {
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

      test('should succeed when "in" has 32767 ids', async () => {
        const n = 32767
        const ids = await createTags(n)
        const tags = await getTagsFindManyIn(ids)

        expect(tags.length).toBe(n)
      })

      test('should succeed when "include" involves 32767 records', async () => {
        const n = 32767
        await createTags(n)
        const tags = await getTagsFindManyInclude()

        expect(tags.length).toBe(n)
      })

      test('should succeed when "in" has 32768 ids', async () => {
        const n = 32768
        const ids = await createTags(n)
        const tags = await getTagsFindManyIn(ids)

        expect(tags.length).toBe(n)
      })

      test('should succeed when "include" involves 32768 records', async () => {
        const n = 32768
        await createTags(n)
        const tags = await getTagsFindManyInclude()

        expect(tags.length).toBe(n)
      })

      test('should succeed when "in" has 32769 ids', async () => {
        const n = 32769
        const ids = await createTags(n)
        const tags = await getTagsFindManyIn(ids)

        expect(tags.length).toBe(n)
      })

      test('should succeed when "include" involves 32769 records', async () => {
        const n = 32769
        await createTags(n)
        const tags = await getTagsFindManyInclude()

        expect(tags.length).toBe(n)
      })

      test('should succeed when "in" has 65537 ids', async () => {
        const n = 65537
        const ids = await createTags(n)
        const tags = await getTagsFindManyIn(ids)

        expect(tags.length).toBe(n)
      })

      test('should succeed when "include" involves 65537 records', async () => {
        const n = 65537
        await createTags(n)
        const tags = await getTagsFindManyInclude()

        expect(tags.length).toBe(n)
      })

      test('should succeed when "in" has 32766 ids and a "skip" filter', async () => {
        const n = 32766
        const ids = await createTags(n)

        const tags = await prisma.tag.findMany({
          where: {
            id: { in: ids },
          },
          skip: 1,
        })

        expect(tags.length).toBe(n - 1)
      })

      test('should succeed when the explicit number of params is 32767 or less', async () => {
        const n = 32767
        const ids = await createTags(n)
        const tags = await getTagsParams(ids)

        expect(tags.length).toBe(n)
      })
    })

    describe('chunking logic does not trigger with 2 IN filters, and results vary between Rust drivers and Driver Adapters', () => {
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

      describeIf(providerFlavor === undefined)('With Rust drivers only', () => {
        // See: https://github.com/prisma/prisma/issues/21802.
        test('Selecting 32767 ids at once in two inclusive disjunct filters results in error: "too many bind variables", but not with mysql', async () => {
          const ids = generatedIds(32767)

          try {
            await selectWith2InFilters(ids)

            if (!['mysql'].includes(provider)) {
              // unreachable
              expect(true).toBe(false)
            }
          } catch (error) {
            const e = error as Error

            if (['postgresql', 'cockroachdb'].includes(provider)) {
              expect(e.message).toContain('Assertion violation on the database')
              expect(e.message).toContain('too many bind variables in prepared statement')
              expect(e.message).toContain(`expected maximum of 32767, received 65534`)
            } else {
              // unreachable
              expect(true).toBe(false)
            }
          }
        })

        test('Selecting 32768 ids at once in two inclusive disjunct filters results in error: "too many bind variables"', async () => {
          const ids = generatedIds(32768)

          try {
            await selectWith2InFilters(ids)
            // unreachable
            expect(true).toBe(false)
          } catch (error) {
            const e = error as Error

            if (['postgresql', 'cockroachdb'].includes(provider)) {
              expect(e.message).toContain('Assertion violation on the database')
              expect(e.message).toContain('too many bind variables in prepared statement')
              expect(e.message).toContain(`expected maximum of 32767, received 65535`)
            } else {
              expect(e.message).toContain('Prepared statement contains too many placeholders')
            }
          }
        })
      })

      describeIf(providerFlavor !== undefined)('With Driver Adapters only', () => {
        test('Selecting 32768 ids at once in two inclusive disjunct filters works', async () => {
          const ids = generatedIds(32768)
          await selectWith2InFilters(ids)
        })

        // See: https://github.com/prisma/prisma/issues/21803.
        test('Selecting 65536 ids at once in two inclusive disjunct filters results in error', async () => {
          const ids = generatedIds(65536)

          try {
            await selectWith2InFilters(ids)
            // unreachable
            expect(true).toBe(false)
          } catch (error) {
            const e = error as Error

            if (['postgresql', 'cockroachdb'].includes(provider)) {
              expect(e.message).toContain('bind message has 32767 parameter formats but 0 parameters')
            }
          }
        })
      })
    })
  },
  {
    optOut: {
      from: ['sqlserver', 'mongodb', 'sqlite'],
      reason:
        'not relevant for this test. Sqlite is excluded due to it lacking `createMany` (see: https://github.com/prisma/prisma/issues/10710).',
    },
    skipProviderFlavor: {
      from: ['js_planetscale'],

      // `rpc error: code = Aborted desc = Row count exceeded 10000 (CallerID: userData1)", state: "70100"`
      // This could potentially be configured in Vitess by increasing the `queryserver-config-max-result-size`
      // query server parameter.
      reason: 'Vitess supports at most 10k rows returned in a single query, so this test is not applicable.',
    },
  },
)
