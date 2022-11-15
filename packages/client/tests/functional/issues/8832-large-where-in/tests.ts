// @ts-ignore
import type { Prisma, PrismaClient, Tag } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/8832
testMatrix.setupTestSuite(
  () => {
    async function createTags(length: number): Promise<number[]> {
      const ids = Array.from({ length }, (_, i) => i + 1)
      const data = ids.map((id) => ({ id }))
      await prisma.tag.createMany({
        data,
      })
      return ids
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

    async function getTagsFindManyInclude(): Promise<Tag[]> {
      const tags = await prisma.tag.findMany({
        include: {
          posts: true,
        },
      })
      return tags
    }

    async function clean() {
      const cleanPrismaPromises = [prisma.tagsOnPosts.deleteMany(), prisma.post.deleteMany(), prisma.tag.deleteMany()]
      for (const promise of cleanPrismaPromises) {
        await promise
      }
    }

    describe('issue #8832', () => {
      beforeEach(async () => {
        await clean()
      }, 60_000)

      test('should succeed when "in" has 32766 ids', async () => {
        const n = 32766
        const ids = await createTags(n)
        const tags = await getTagsFindManyIn(ids)

        expect(tags.length).toBe(n)
      })

      test('should succeed when "include" involves 32766 records', async () => {
        const n = 32766
        await createTags(n)
        const tags = await getTagsFindManyInclude()

        expect(tags.length).toBe(n)
      })

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

      test('should succeed when "in" has 65536 ids', async () => {
        const n = 65536
        const ids = await createTags(n)
        const tags = await getTagsFindManyIn(ids)

        expect(tags.length).toBe(n)
      })

      test('should succeed when "include" involves 65536 records', async () => {
        const n = 65536
        await createTags(n)
        const tags = await getTagsFindManyInclude()

        expect(tags.length).toBe(n)
      })

      /**
       * Highlight scenarios of the query chunking logic behavior depending on how the bind variables are counted
       * in the query filters.
       */
      describe('unhandled filters', () => {
        test('should fail with `Assertion violation` when "in" is repeated at least twice and "n" is the default value of $QUERY_BATCH_SIZE', async () => {
          expect.assertions(3)
          const n = 32766
          const ids = await createTags(n)

          try {
            await prisma.tag.findMany({
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
          } catch (e) {
            const error = e as Prisma.PrismaClientKnownRequestError
            expect(error.message).toContain(
              'Assertion violation on the database: `too many bind variables in prepared statement, expected maximum of 32767, received 65533`',
            )
            expect(error.code).toBe('P2035')
            expect(error.meta).toMatchObject({
              database_error:
                'too many bind variables in prepared statement, expected maximum of 32767, received 65533',
            })
          }
        })

        test('should fail with `Assertion violation` when "in" has 32766 ids and a "take" filter', async () => {
          expect.assertions(3)
          const n = 32766
          const ids = await createTags(n)

          try {
            await prisma.tag.findMany({
              where: {
                id: { in: ids },
              },
              take: 1,
            })
          } catch (e) {
            const error = e as Prisma.PrismaClientKnownRequestError
            expect(error.message).toContain(
              'Assertion violation on the database: `too many bind variables in prepared statement, expected maximum of 32767, received 32768`',
            )
            expect(error.code).toBe('P2035')
            expect(error.meta).toMatchObject({
              database_error:
                'too many bind variables in prepared statement, expected maximum of 32767, received 32768',
            })
          }
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
      })
    })
  },
  {
    optOut: {
      from: ['mysql', 'sqlserver', 'cockroachdb', 'sqlite', 'mongodb'],
      reason: 'we have only captured this issue with postgres',
    },
  },
)
