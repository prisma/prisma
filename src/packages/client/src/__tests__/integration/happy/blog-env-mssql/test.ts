import sql from 'sql-template-tag'

import { generateTestClient } from '../../../../utils/getTestClient'
import { SetupParams, setupMSSQL } from '../../../../utils/setupMSSQL'

describe('blog-env-mssql', () => {
  const {
    PrismaClient,
    PrismaClientValidationError,
    prismaVersion,
  } = require('./node_modules/@prisma/client')

  const connectionString =
    process.env.TEST_MSSQL_URI || 'mssql://SA:Pr1smaLong@localhost:1433/master'
  const setupParams: SetupParams = {
    connectionString,
    dirname: __dirname,
  }

  let prisma: typeof PrismaClient | null = null // Generated Client instance
  let requests: any[] = []

  beforeAll(async () => {
    await generateTestClient()

    await setupMSSQL(setupParams)

    prisma = new PrismaClient({
      errorFormat: 'colorless',
      __internal: {
        measurePerformance: true,
        hooks: {
          beforeRequest: (r: any) => requests.push(r),
        },
      },
      datasources: {
        db: {
          url: connectionString,
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
    prisma!.$disconnect()
  })

  test('includes version in generated client', () => {
    expect(prismaVersion).not.toBeUndefined()
    expect(prismaVersion.client).not.toBeUndefined()
  })

  test('does not leak connection strings in node_modules', () => {
    expect(prisma.internalDatasources).toBeUndefined()
  })

  test('invokes beforeRequest hook', async () => {
    await prisma.user.findMany()
    expect(requests).toHaveLength(1)
  })

  test('can throw validation errors', async () => {
    try {
      await prisma.post.create({
        data: {},
      })

      expect(false).toBe(true) // The line above needs to throw, so this should never be executed, but if it does, it will fail the test
    } catch (e) {
      expect(e).not.toBeUndefined()
      expect(e).toBeInstanceOf(PrismaClientValidationError)
    }
  })

  // The next few tests just run an async function without any assertions
  // The idea is that if any function throws an error, the corresponding test would fail

  test('can run findMany queries', async () => {
    await prisma.user.findMany()
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
    await prisma.post.create({
      data: {
        published: false,
        title: 'Some title',
      },
    })
  })

  test('can run delete queries', async () => {
    const post = await prisma.post.create({
      data: {
        published: false,
        title: 'Some title',
      },
    })
    await prisma.post.delete({
      where: { id: post.id },
    })
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

  describe('$queryRaw', () => {
    test('$queryRaw(string)', async () => {
      await prisma.user.create({ data: { email: 'a@a.de', name: 'A' } })
      const users = await prisma.$queryRaw('SELECT * FROM [dbo].[User]')
      expect(users).not.toHaveLength(0)
    })

    test('$queryRaw(string) with params', async () => {
      await prisma.user.create({ data: { email: 'b@a.de', name: 'B' } })
      const users = await prisma.$queryRaw(
        'SELECT * FROM [dbo].[User] WHERE name = @P1',
        'B',
      )
      expect(users).not.toHaveLength(0)
    })

    test('$queryRaw(sql`<SQL>`)', async () => {
      await prisma.user.create({ data: { email: 'c@a.de', name: 'C' } })
      const users = await prisma.$queryRaw(sql`SELECT * FROM [dbo].[User]`)
      expect(users).not.toHaveLength(0)
    })

    // Deliberately skipped test to signify that this call style is not supported
    test.skip('$queryRaw(sql`<SQL`) with params', async () => {})

    test('$queryRaw`<SQL>`', async () => {
      await prisma.user.create({ data: { email: 'd@a.de', name: 'D' } })
      const users = await prisma.$queryRaw`SELECT * FROM [dbo].[User]`
      expect(users).not.toHaveLength(0)
    })

    test('$queryRaw`<SQL>` with params', async () => {
      await prisma.user.create({ data: { email: 'e@a.de', name: 'E' } })
      const users = await prisma.$queryRaw`SELECT * FROM [dbo].[User] WHERE name = ${'E'}`
      expect(users[0].name).toBe('E')
    })
  })

  describe('$executeRaw', () => {
    test('$executeRaw(string)', async () => {
      await prisma.user.create({ data: { email: 'a@b.de', name: 'A' } })
      const users = await prisma.$executeRaw('SELECT * FROM [dbo].[User]')
      expect(users).not.toBe(0)
    })

    test('$executeRaw(string) with params', async () => {
      await prisma.user.create({ data: { email: 'b@b.de', name: 'B' } })
      const users = await prisma.$executeRaw(
        'SELECT * FROM [dbo].[User] WHERE name = @P1',
        'B',
      )
      expect(users).not.toBe(0)
    })

    test('$executeRaw(sql`<SQL>`)', async () => {
      await prisma.user.create({ data: { email: 'c@c.de', name: 'C' } })
      const users = await prisma.$executeRaw(sql`SELECT * FROM [dbo].[User]`)
      expect(users).not.toBe(0)
    })

    // Deliberately skipped test to signify that this call style is not supported
    test.skip('$executeRaw(sql`<SQL`) with params', async () => {})

    test('$executeRaw`<SQL>`', async () => {
      await prisma.user.create({ data: { email: 'd@d.de', name: 'D' } })
      const users = await prisma.$executeRaw`SELECT * FROM [dbo].[User]`
      expect(users).not.toBe(0)
    })

    test('$executeRaw`<SQL>` with params', async () => {
      await prisma.user.create({ data: { email: 'e@e.de', name: 'E' } })
      const users = await prisma.$executeRaw`SELECT * FROM [dbo].[User] WHERE name = ${'E'}`
      expect(users).not.toBe(0)
    })
  })
})
