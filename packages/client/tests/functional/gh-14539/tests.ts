// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    describe('issue #14539', () => {
      async function createTags(length: number): Promise<number[]> {
        const ids = Array.from({ length }, (_, i) => i + 1)

        const prismaPromises: any = []
        for (const id of ids) {
          prismaPromises.push(
            prisma.tag.create({
              data: {
                id,
              },
            }),
          )
        }

        await prisma.$transaction(prismaPromises)

        return ids
      }

      async function createPostsWith2TagsEach(length: number): Promise<number[]> {
        const ids = Array.from({ length }, (_, i) => i * 2 + 1)
        const prismaPromises: any = []

        // each post (with even ids) has two tags (one with the same id, one with an odd id)
        for (const id of ids) {
          prismaPromises.push(
            prisma.post.create({
              data: {
                id,
                tags: {
                  create: [
                    {
                      tag: {
                        create: {
                          id: id,
                        },
                      },
                    },
                    {
                      tag: {
                        create: {
                          id: id + 1,
                        },
                      },
                    },
                  ],
                },
              },
            }),
          )
        }

        await prisma.$transaction(prismaPromises)

        return ids
      }

      beforeEach(async () => {
        // clean the database before each test
        const prismaPromises = [prisma.tagsOnPosts.deleteMany(), prisma.tag.deleteMany(), prisma.post.deleteMany()]
        await prisma.$transaction(prismaPromises)
      })

      test('findMany + include without creating anything first', async () => {
        const posts = await prisma.post.findMany({
          include: {
            tags: {
              include: {
                tag: true,
                post: true,
              },
            },
          },
        })

        expect(posts).toEqual([])
      })

      test('$queryRaw + IN after creating few elements', async () => {
        const ids = await createTags(5)
        const tags = await prisma.$queryRawUnsafe(`
          SELECT * FROM tags
          WHERE id IN (${ids.join(',')})
      `)
        expect(tags).toMatchObject([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }])
      })

      test('$queryRaw + IN after creating 1000+ elements', async () => {
        const ids = await createTags(1000)
        const tags = await prisma.$queryRawUnsafe(`
          SELECT * FROM tags
          WHERE id IN (${ids.join(',')})
          ORDER BY id ASC
      `)
        expect(tags).toHaveLength(1000)
        expect(tags[0]).toMatchObject({ id: 1 })
        expect(tags[999]).toMatchObject({ id: 1000 })
      })

      test('findMany + IN after creating few elements', async () => {
        const ids = await createTags(5)
        const tags = await prisma.tag.findMany({
          where: {
            id: {
              in: ids,
            },
          },
          // orderBy: { id: 'asc' },
        })
        expect(tags).toHaveLength(5)
        expect(tags).toMatchObject([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }])
      })

      test('findMany + IN after creating at least 1000 random elements', async () => {
        await createTags(5000)
        const randomIds = [...new Set(Array.from({ length: 5000 }, () => Math.floor(Math.random() * 5000)))]
        const tags = await prisma.tag.findMany({
          where: {
            id: {
              in: randomIds,
            },
          },
          // orderBy: { id: 'asc' },
        })

        expect(tags.length).toBeGreaterThan(1)
      })

      test('findMany + include after creating few elements', async () => {
        await createPostsWith2TagsEach(2)
        const posts = await prisma.post.findMany({
          include: {
            tags: {
              include: {
                tag: true,
                post: true,
              },
            },
          },
        })

        expect(posts).toHaveLength(2)
        expect(posts).toMatchObject([
          {
            id: 1,
            tags: [
              { post: { id: 1 }, postId: 1, tag: { id: 1 }, tagId: 1 },
              { post: { id: 1 }, postId: 1, tag: { id: 2 }, tagId: 2 },
            ],
          },
          {
            id: 3,
            tags: [
              { post: { id: 3 }, postId: 3, tag: { id: 3 }, tagId: 3 },
              { post: { id: 3 }, postId: 3, tag: { id: 4 }, tagId: 4 },
            ],
          },
        ])
      })

      test('findMany + include after creating 1000+ elements', async () => {
        const ids = await createPostsWith2TagsEach(5000)
        const posts = await prisma.post.findMany({
          include: {
            tags: {
              include: {
                tag: true,
                post: true,
              },
            },
          },
        })

        expect(posts).toHaveLength(5000)
      })
    })
  },
  {
    optOut: {
      from: ['sqlite', 'cockroachdb', 'postgresql', 'sqlserver', 'mongodb'],
      reason: 'Whatever',
    },
  },
)
