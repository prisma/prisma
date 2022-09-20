import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/8832
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

    async function getTagsFindManyIn(ids: number[]): Promise<unknown[]> {
      const tags = await prisma.tag.findMany({
        where: {
          id: {
            in: ids,
          },
        },
      })
      return tags
    }

    async function getTagsFindManyInclude(): Promise<unknown[]> {
      const tags = await prisma.tag.findMany({
        include: {
          posts: true,
        },
      })
      return tags
    }

    async function clean() {
      const cleanPrismaPromises = [prisma.tagsOnPosts.deleteMany(), prisma.post.deleteMany(), prisma.tag.deleteMany()]
      await prisma.$transaction(cleanPrismaPromises)
    }

    describe('issue #8832', () => {
      beforeEach(async () => {
        await clean()
      }, 10_000)

      test('should succeed when "in" has 32766 or less ids', async () => {
        const n = 32766
        const ids = await createTags(n)
        const tags = await getTagsFindManyIn(ids)

        expect(tags.length).toBe(n)
      })

      test('should succeed when "include" involves 32766 or less records', async () => {
        const n = 32766
        await createTags(n)
        const tags = await getTagsFindManyInclude()

        expect(tags.length).toBe(n)
      })

      test('should fail with `value too large to transmit` when "in" has 32767+ ids', async () => {
        expect.assertions(3)
        const n = 32767
        const ids = await createTags(n)

        try {
          await getTagsFindManyIn(ids)
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

      test('should fail with `value too large to transmit` when "include" involves 32767+ records', async () => {
        expect.assertions(3)
        const n = 32767
        const ids = await createTags(n)

        try {
          await getTagsFindManyInclude()
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
