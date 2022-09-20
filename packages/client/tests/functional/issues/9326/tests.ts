import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/9326
testMatrix.setupTestSuite(
  ({ provider }) => {
    async function createTags(length: number): Promise<number[]> {
      const ids = Array.from({ length }, (_, i) => i + 1)
      const data = ids.map((id) => ({ id }))
      await prisma.tag.createMany({
        data,
      })
      return ids
    }

    async function getTagsParams(ids: number[]): Promise<unknown[]> {
      const idsParams = ids.map((paramIdx) => `\$${paramIdx}`)

      const tags = await prisma.$queryRawUnsafe<unknown[]>(
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
      await prisma.$transaction(cleanPrismaPromises)
    }

    describe('issue #9326', () => {
      beforeEach(async () => {
        await clean()
      }, 10_000)

      test('should succeed when the number of params is 32767 or less', async () => {
        const n = 32767
        const ids = await createTags(n)
        const tags = await getTagsParams(ids)

        expect(tags.length).toBe(n)
      })

      test('should fail with `value too large to transmit` when the number of params is 32768+', async () => {
        expect.assertions(3)
        const n = 32768
        const ids = await createTags(n)

        try {
          await getTagsParams(ids)
        } catch (e) {
          const error = e as Error
          // @ts-ignore
          expect(error.message).toContain('Assertion violation on the database: `value too large to transmit`')

          // @ts-ignore
          expect(error.code).toBe('P2034')

          // @ts-ignore
          expect(error.meta).toMatchObject({
            database_error: 'value too large to transmit',
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
