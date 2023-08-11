import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma, PrismaClient, Tag } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/9326
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

    async function getTagsParams(ids: number[]): Promise<Tag[]> {
      const idsParams = ids.map((paramIdx) => `\$${paramIdx}`)

      const tags = await prisma.$queryRawUnsafe<Tag[]>(
        `
        SELECT *
        FROM tag
        WHERE "id" IN (${idsParams.join(', ')})
      `,
        ...ids,
      )
      return tags
    }

    async function clean() {
      const cleanPrismaPromises = [prisma.tagsOnPosts.deleteMany(), prisma.post.deleteMany(), prisma.tag.deleteMany()]
      for (const promise of cleanPrismaPromises) {
        await promise
      }
    }

    describe('issue #9326', () => {
      beforeEach(async () => {
        await clean()
      }, 30_000)

      test('should succeed when the number of params is 32767 or less', async () => {
        const n = 32767
        const ids = await createTags(n)
        const tags = await getTagsParams(ids)

        expect(tags.length).toBe(n)
      })

      test('should fail with `Assertion violation` when the number of params is 32768+', async () => {
        expect.assertions(3)
        const n = 32768
        const ids = await createTags(n)

        try {
          await getTagsParams(ids)
        } catch (e) {
          const error = e as Prisma.PrismaClientKnownRequestError
          expect(error.message).toContain(
            'Assertion violation on the database: `too many bind variables in prepared statement, expected maximum of 32767, received 32768`',
          )
          expect(error.code).toBe('P2035')
          expect(error.meta).toMatchObject({
            database_error: 'too many bind variables in prepared statement, expected maximum of 32767, received 32768',
          })
        }
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
