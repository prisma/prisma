import sql from 'sql-template-tag'

import { generateTestClient } from '../../../../utils/getTestClient'
import { SetupParams, setupMSSQL } from '../../../../utils/setupMSSQL'

describe('blog-env-mssql', () => {
  let prisma: any = null // Generated Client instance
  let requests: any[] = []

  beforeAll(async () => {
    const connectionString =
      process.env.TEST_MSSQL_URI ||
      'mssql://SA:Pr1sm4_Pr1sm4@localhost:1433/master'
    const setupParams: SetupParams = {
      connectionString,
      dirname: __dirname,
    }

    await setupMSSQL(setupParams)

    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')

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

  afterAll(async () => {
    prisma!.$disconnect()
  })

  test('includes version in generated client', () => {
    const { Prisma } = require('./node_modules/@prisma/client')

    const { prismaVersion } = Prisma

    expect(prismaVersion).not.toBeUndefined()
    expect(prismaVersion.client).not.toBeUndefined()
  })

  test('invokes beforeRequest hook', async () => {
    await prisma.user.findMany()
    expect(requests).toHaveLength(1)
  })

  test('can throw validation errors', async () => {
    const {
      Prisma: {
        PrismaClientValidationError,
      }
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

    test('$queryRaw(sql`<SQL>`) with params', async () => {
      await prisma.user.create({ data: { email: 'd@a.de', name: 'D' } })
      const users = await prisma.$queryRaw(
        sql`SELECT * FROM [dbo].[User] WHERE name = ${'D'}`,
      )
      expect(users).not.toHaveLength(0)
    })

    test('$queryRaw`<SQL>`', async () => {
      await prisma.user.create({ data: { email: 'e@a.de', name: 'E' } })
      const users = await prisma.$queryRaw`SELECT * FROM [dbo].[User]`
      expect(users).not.toHaveLength(0)
    })

    test('$queryRaw`<SQL>` with params', async () => {
      await prisma.user.create({ data: { email: 'f@a.de', name: 'F' } })
      const users = await prisma.$queryRaw`SELECT * FROM [dbo].[User] WHERE name = ${'F'}`
      expect(users[0].name).toBe('F')
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
      await prisma.user.create({ data: { email: 'c@b.de', name: 'C' } })
      const users = await prisma.$executeRaw(sql`SELECT * FROM [dbo].[User]`)
      expect(users).not.toBe(0)
    })

    test('$executeRaw(sql`<SQL>`) with params', async () => {
      await prisma.user.create({ data: { email: 'd@b.de', name: 'D' } })
      const users = await prisma.$queryRaw(
        sql`SELECT * FROM [dbo].[User] WHERE name = ${'D'}`,
      )
      expect(users).not.toHaveLength(0)
    })

    test('$executeRaw`<SQL>`', async () => {
      await prisma.user.create({ data: { email: 'e@b.de', name: 'E' } })
      const users = await prisma.$executeRaw`SELECT * FROM [dbo].[User]`
      expect(users).not.toBe(0)
    })

    test('$executeRaw`<SQL>` with params', async () => {
      await prisma.user.create({ data: { email: 'f@b.de', name: 'F' } })
      const users = await prisma.$executeRaw`SELECT * FROM [dbo].[User] WHERE name = ${'F'}`
      expect(users).not.toBe(0)
    })
  })
})
