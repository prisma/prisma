import { generateTestClient } from '../../../../utils/getTestClient'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describeIf(!process.env.TEST_SKIP_MONGODB)('blog-env-mongo', () => {
  let prisma: PrismaClient // Generated Client instance

  beforeAll(async () => {
    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')

    prisma = new PrismaClient({
      errorFormat: 'colorless',
      __internal: {
        measurePerformance: true,
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
        ids: ['620e79238fb8973a4a738664', '620e792a4927392287834903'],
      },
    })

    expect(post).not.toBeUndefined()
    expect(post.ids).toHaveLength(2)
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
      {
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
        ids: ['620e79866f46aba24d751441'],
      },
      select: {
        authorId: true,
        content: true,
        published: true,
        title: true,
        ids: true,
      },
    })

    expect(updatedPost).toMatchInlineSnapshot(`
      {
        authorId: null,
        content: null,
        ids: [
          620e79866f46aba24d751441,
        ],
        published: false,
        title: Updated title,
      }
    `)
  })

  test('should throw Malformed ObjectID error: in 2 different fields', async () => {
    const post = prisma.post.create({
      data: {
        id: 'something invalid 1111', // first
        published: false,
        title: 'Some title',
        ids: ['something invalid 2222'], // second
      },
    })

    // Message doesn't distinguish if one or more values failed / which one failed
    // seems it errors on the first one
    // https://github.com/prisma/prisma/issues/11885
    await expect(post).rejects.toThrowErrorMatchingInlineSnapshot(`

      Invalid \`prisma.post.create()\` invocation in
      /client/src/__tests__/integration/happy/blog-env-mongo/test.ts:0:0

        170 })
        171 
        172 test('should throw Malformed ObjectID error: in 2 different fields', async () => {
      → 173   const post = prisma.post.create(
      Inconsistent column data: Malformed ObjectID: invalid character 's' was found at index 0 in the provided hex string: "something invalid 1111" for the field 'id'.
    `)
  })

  test('should throw Malformed ObjectID error for: _id', async () => {
    const post = prisma.post.create({
      data: {
        published: false,
        title: 'Some title',
        ids: ['something invalid'],
      },
    })

    await expect(post).rejects.toThrow(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect.objectContaining({
        message: expect.stringContaining('Malformed ObjectID'),
      }),
    )
  })

  test('should throw Malformed ObjectID error for: ids String[] @db.ObjectId', async () => {
    const post = prisma.post.create({
      data: {
        id: 'something invalid',
        published: false,
        title: 'Some title',
      },
    })

    await expect(post).rejects.toThrow(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect.objectContaining({
        message: expect.stringContaining('Malformed ObjectID'),
      }),
    )
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
        [
          {
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
        [
          {
            _id: B,
            total: 2,
          },
          {
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
        [
          {
            email: 1@a.de,
          },
          {
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
        {
          cursor: {
            firstBatch: [
              {
                email: 1@a.de,
              },
              {
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
