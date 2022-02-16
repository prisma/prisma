import { generateTestClient } from '../../../../utils/getTestClient'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describeIf(!process.env.TEST_SKIP_MONGODB)('blog-env-mongo', () => {
  let prisma: PrismaClient // Generated Client instance
  let PrismaHelpers: any = null
  const requests: any[] = []

  beforeAll(async () => {
    await generateTestClient()
    const { PrismaClient, Prisma } = require('./node_modules/@prisma/client')

    PrismaHelpers = Prisma
    prisma = new PrismaClient({
      errorFormat: 'colorless',
      __internal: {
        measurePerformance: true,
        hooks: {
          beforeRequest: (r: any) => requests.push(r),
        },
      },
      log: [
        {
          emit: 'event',
          level: 'error',
        },
      ],
    })
  })

  afterEach(async () => {
    for (const key of Object.keys(prisma)) {
      await prisma[key]?.['deleteMany']?.()
    }
    await prisma.$disconnect()
  })

  test('includes version in generated client', () => {
    const { Prisma } = require('./node_modules/@prisma/client')

    const { prismaVersion } = Prisma

    expect(prismaVersion).not.toBeUndefined()
    expect(prismaVersion.client).not.toBeUndefined()
  })

  test('does not leak connection strings in node_modules', () => {
    // @ts-ignore
    expect(prisma.internalDatasources).toBeUndefined()
  })

  test('invokes beforeRequest hook', async () => {
    await prisma.user.findMany()
    expect(requests.length).toBeGreaterThan(0)
  })

  test('can throw validation errors', async () => {
    expect.assertions(2)

    const {
      Prisma: { PrismaClientValidationError },
    } = require('./node_modules/@prisma/client')

    try {
      await prisma.post.create({
        // @ts-ignore
        data: {},
      })
    } catch (e) {
      expect(e).not.toBeUndefined()
      expect(e).toBeInstanceOf(PrismaClientValidationError)
    }
  })

  test('can run findMany queries', async () => {
    await prisma.post.create({
      data: {
        published: false,
        title: 'title',
        content: 'content',
      },
    })
    const posts = await prisma.post.findMany()
    expect(posts).not.toHaveLength(0)
  })

  test('can run findMany queries with a `null` where', async () => {
    await prisma.post.create({
      data: {
        published: false,
        title: 'null where',
        content: null,
      },
    })
    const posts = await prisma.post.findMany({
      where: {
        content: null,
      },
    })
    expect(posts.length).not.toBe(0)
  })

  test('can run create queries', async () => {
    const post = await prisma.post.create({
      data: {
        published: false,
        title: 'Some title',
      },
    })

    expect(post).not.toBeUndefined()
  })

  test('can run delete queries', async () => {
    const post = await prisma.post.create({
      data: {
        published: false,
        title: 'Some title',
      },
    })
    const deletedPost = await prisma.post.delete({
      where: { id: post.id },
      select: {
        authorId: true,
        content: true,
        published: true,
        title: true,
      },
    })

    expect(deletedPost).toMatchInlineSnapshot(`
          Object {
            authorId: null,
            content: null,
            published: false,
            title: Some title,
          }
      `)
  })

  test('can run update queries', async () => {
    const post = await prisma.post.create({
      data: {
        published: false,
        title: 'Some title',
      },
    })
    const updatedPost = await prisma.post.update({
      where: {
        id: post.id,
      },
      data: {
        title: 'Updated title',
      },
      select: {
        authorId: true,
        content: true,
        published: true,
        title: true,
      },
    })

    expect(updatedPost).toMatchInlineSnapshot(`
          Object {
            authorId: null,
            content: null,
            published: false,
            title: Updated title,
          }
      `)
  })

  describe('findRaw', () => {
    test('all', async () => {
      await prisma.user.create({ data: { email: 'c@a.de', name: 'C' } })
      const users = await prisma.user.findRaw({})
      expect(users).not.toHaveLength(0)
    })

    test('single', async () => {
      await prisma.user.create({ data: { email: 'd@a.de', name: 'D' } })
      const users = await prisma.user.findRaw({ filter: { name: 'D' } })
      expect(users).toHaveLength(1)
    })

    test('projection', async () => {
      await prisma.user.create({ data: { email: 'e@a.de', name: 'E' } })
      const users = await prisma.user.findRaw({
        filter: { name: 'E' },
        options: { projection: { _id: false } },
      })
      expect(users).toMatchInlineSnapshot(`
        Array [
          Object {
            email: e@a.de,
            name: E,
          },
        ]
      `)
    })
  })

  describe('aggregateRaw', () => {
    test('group', async () => {
      await prisma.user.create({ data: { email: '1@a.de', name: 'A' } })
      await prisma.user.create({ data: { email: '2@a.de', name: 'A' } })
      await prisma.user.create({ data: { email: '3@a.de', name: 'B' } })
      await prisma.user.create({ data: { email: '4@a.de', name: 'B' } })
      const users = await prisma.user.aggregateRaw({
        pipeline: [{ $group: { _id: '$name', total: { $sum: 1 } } }, { $sort: { _id: -1 } }],
      })
      expect(users).toMatchInlineSnapshot(`
        Array [
          Object {
            _id: B,
            total: 2,
          },
          Object {
            _id: A,
            total: 2,
          },
        ]
      `)
    })

    test('match', async () => {
      await prisma.user.create({ data: { email: '1@a.de', name: 'A' } })
      await prisma.user.create({ data: { email: '3@a.de', name: 'A' } })
      const users = await prisma.user.aggregateRaw({
        pipeline: [{ $match: { name: 'A' } }, { $project: { email: true, _id: false } }],
      })
      expect(users).toMatchInlineSnapshot(`
        Array [
          Object {
            email: 1@a.de,
          },
          Object {
            email: 3@a.de,
          },
        ]
      `)
    })
  })

  describe('runCommandRaw', () => {
    test('aggregate', async () => {
      await prisma.user.create({ data: { email: '1@a.de', name: 'A' } })
      await prisma.user.create({ data: { email: '3@a.de', name: 'A' } })

      const users = await prisma.$runCommandRaw({
        aggregate: 'User',
        pipeline: [{ $match: { name: 'A' } }, { $project: { email: true, _id: false } }],
        explain: false,
      })

      expect(users).toMatchInlineSnapshot(`
        Object {
          cursor: Object {
            firstBatch: Array [
              Object {
                email: 1@a.de,
              },
              Object {
                email: 3@a.de,
              },
            ],
            id: 0,
            ns: tests.User,
          },
          ok: 1,
        }
      `)
    })
  })
})
