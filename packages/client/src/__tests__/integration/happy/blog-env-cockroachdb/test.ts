import sql from 'sql-template-tag'

import { generateTestClient } from '../../../../utils/getTestClient'
import type { SetupParams } from '../../../../utils/setupPostgres'
import { setupPostgres, tearDownPostgres } from '../../../../utils/setupPostgres'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describeIf(!process.env.TEST_SKIP_COCKROACHDB)('Blog fixture: Cockroachdb', () => {
  let prisma: any = null
  let PrismaHelpers: any = null
  let setupParams: any = null
  const requests: any[] = []
  const errorLogs: any[] = []

  beforeAll(async () => {
    let originalConnectionString = process.env.TEST_COCKROACH_URI || 'postgresql://prisma@localhost:26257/tests'
    originalConnectionString += '-blog-env-cockroachdb'

    setupParams = {
      connectionString: originalConnectionString,
      dirname: __dirname,
    }

    await setupPostgres(setupParams)

    await generateTestClient()
    const { PrismaClient, Prisma } = require('./node_modules/@prisma/client')
    PrismaHelpers = Prisma

    prisma = new PrismaClient({
      errorFormat: 'colorless',
      __internal: {
        measurePerformance: true,
        hooks: {
          beforeRequest: (request) => requests.push(request),
        },
      },
      datasources: {
        db: {
          url: originalConnectionString,
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

  afterAll(async () => {
    await prisma.$disconnect()
    await tearDownPostgres(setupParams.connectionString)
  })

  test('includes version in generated client', () => {
    const { Prisma } = require('./node_modules/@prisma/client')

    const { prismaVersion } = Prisma

    expect(prismaVersion).not.toBeUndefined()
    expect(prismaVersion.client).not.toBeUndefined()
  })

  test('does not leak connection strings in node_modules', () => {
    expect(prisma.internalDatasources).toBeUndefined()
  })

  test('can perform $queryRawUnsafe', async () => {
    const rawQuery = await prisma.$queryRawUnsafe('SELECT 1')
    expect(rawQuery[0]['?column?']).toBe(BigInt('1'))
  })

  test('can perform $queryRaw', async () => {
    const rawQuery = await prisma.$queryRaw`SELECT 1`
    expect(rawQuery[0]['?column?']).toBe(BigInt('1'))
  })

  test('Can do find query with client', async () => {
    const users1 = await prisma.user.findMany()
    expect(users1.length).toBe(1)
  })

  test('can throw validation errors', async () => {
    const {
      Prisma: { PrismaClientValidationError },
    } = require('./node_modules/@prisma/client')

    try {
      await prisma.post.create({
        data: {},
      })

      expect(false).toBe(true) // The line above needs to throw, so this should never be executed, but if it does (aka the line above did not throw, as expected), it will fail the test
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

    const resultJsonArray = await prisma.post.create({
      data: {
        published: false,
        title: 'json array',
        jsonData: [
          {
            array1key: 'array1value',
          },
        ],
      },
    })
    const result = await prisma.post.findMany({
      where: {
        jsonData: {
          equals: [
            {
              array1key: 'array1value',
            },
          ],
        },
      },
    })
    expect(result.length).toBe(1)

    const resultJsonUpdateWithSet = await prisma.post.update({
      where: {
        id: resultJsonArray.id,
      },
      data: {
        title: 'json array updated 2',
        jsonData: {
          set: [
            {
              array1key: 'array1valueupdated',
            },
          ],
        },
        coinflips: {
          set: [true, true, true, false, true],
        },
      },
      select: {
        authorId: true,
        coinflips: true,
        content: true,
        jsonData: true,
        published: true,
        title: true,
      },
    })
    expect(resultJsonUpdateWithSet).toMatchInlineSnapshot(`
    Object {
      authorId: null,
      coinflips: Array [
        true,
        true,
        true,
        false,
        true,
      ],
      content: null,
      jsonData: Object {
        set: Array [
          Object {
            array1key: array1valueupdated,
          },
        ],
      },
      published: false,
      title: json array updated 2,
    }
  `)
  })

  describe('$queryRaw', () => {
    test('$queryRaw(sql`<SQL>`)', async () => {
      await prisma.user.create({ data: { email: 'c@a.de', name: 'C' } })
      const users = await prisma.$queryRaw(sql`SELECT * FROM "public"."User"`)
      expect(users).not.toHaveLength(0)
    })

    test('$queryRaw(sql`<SQL>`) with params', async () => {
      await prisma.user.create({ data: { email: 'd@a.de', name: 'D' } })
      const users = await prisma.$queryRaw(sql`SELECT * FROM "public"."User" WHERE name = ${'D'}`)
      expect(users).not.toHaveLength(0)
    })

    test('$queryRaw`<SQL>`', async () => {
      await prisma.user.create({ data: { email: 'e@a.de', name: 'E' } })
      const users = await prisma.$queryRaw`SELECT * FROM "public"."User"`
      expect(users).not.toHaveLength(0)
    })

    test('$queryRaw`<SQL>` with join', async () => {
      const users = await prisma.$queryRaw`SELECT * FROM "public"."User" WHERE id IN (${PrismaHelpers.join([
        '42',
        '333',
        '2048',
      ])})`
      expect(users).toHaveLength(0)
    })

    test('$queryRaw`<SQL>` with params', async () => {
      await prisma.user.create({ data: { email: 'f@a.de', name: 'F' } })
      const users = await prisma.$queryRaw`SELECT * FROM "public"."User" WHERE name = ${'F'}`
      expect(users[0].name).toBe('F')
    })

    test('$queryRaw(string) error', async () => {
      const users = prisma.$queryRaw('<strings will throw>')

      await expect(users).rejects.toThrowErrorMatchingSnapshot()
    })
  })

  test('$executeRaw', async () => {
    // Test executeRaw(string)
    const rawexecute = await prisma.$executeRawUnsafe('SELECT 1')
    expect(rawexecute).toBe(1)

    // Test executeRaw``
    const rawexecuteTemplate = await prisma.$executeRaw`SELECT 1`
    expect(rawexecuteTemplate).toBe(1)

    // Test executeRaw`` with ${param}
    const rawexecuteTemplateWithParams = await prisma.$executeRaw`SELECT * FROM "public"."User" WHERE name = ${'Alice'}`
    expect(rawexecuteTemplateWithParams).toBe(1)
  })
})
