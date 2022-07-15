import { faker } from '@faker-js/faker'
import { trace } from '@opentelemetry/api'
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import * as util from 'util'

import testMatrix from './_matrix'

type Tree = {
  span: ReadableSpan
  children?: Tree[]
}

function buildTree(tree: Tree, spans: ReadableSpan[]): Tree {
  // @ts-ignore - For JSON stringify debugging
  delete tree.span._spanProcessor

  const childrenSpans = spans.filter((span) => span.parentSpanId === tree.span.spanContext().spanId)
  if (childrenSpans.length) {
    tree.children = childrenSpans.map((span) => buildTree({ span }, spans))
  } else {
    tree.children = []
  }

  return tree
}

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore this is just for type checks
declare let PrismaClient: typeof import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(({ provider }, __, inMemorySpanExporter) => {
  beforeEach(() => {
    inMemorySpanExporter.reset()
  })

  async function waitForSpanTree(): Promise<Tree> {
    /*
        Spans comes thru logs and sometimes these tests
        can be flaky without giving some buffer
      */
    const logBuffer = () => util.promisify(setTimeout)(500)
    await logBuffer()

    const spans = inMemorySpanExporter.getFinishedSpans()
    const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
    const tree = buildTree({ span: rootSpan }, spans)

    return tree
  }

  describe('tracing on crud methods', () => {
    let email = faker.internet.email()

    test('create', async () => {
      await prisma.user.create({
        data: {
          email: email,
        },
      })

      const tree = await waitForSpanTree()

      expect(tree.span.name).toEqual('prisma')
      expect(tree.span.attributes['method']).toEqual('create')
      expect(tree.span.attributes['model']).toEqual('User')

      expect(tree.children).toHaveLength(1)

      const engine = (tree?.children || [])[0] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:query_builder')

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:connection')

      if (provider === 'mongodb') {
        expect(engine.children).toHaveLength(3)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('db.User.insertOne(*)')

        const dbQuery2 = (engine.children || [])[2]
        expect(dbQuery2.span.name).toEqual('prisma:db_query')
        expect(dbQuery2.span.attributes['db.statement']).toContain('db.User.findOne(*)')

        return
      }

      expect(engine.children).toHaveLength(5)

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toContain('BEGIN')

      const dbQuery2 = (engine.children || [])[2]
      expect(dbQuery2.span.name).toEqual('prisma:db_query')
      expect(dbQuery2.span.attributes['db.statement']).toContain('INSERT')

      const dbQuery3 = (engine.children || [])[3]
      expect(dbQuery3.span.name).toEqual('prisma:db_query')
      expect(dbQuery3.span.attributes['db.statement']).toContain('SELECT')

      const dbQuery4 = (engine.children || [])[4]
      expect(dbQuery4.span.name).toEqual('prisma:db_query')
      expect(dbQuery4.span.attributes['db.statement']).toContain('COMMIT')
    })

    test('read', async () => {
      await prisma.user.findMany({
        where: {
          email: email,
        },
      })

      const tree = await waitForSpanTree()

      expect(tree.span.name).toEqual('prisma')
      expect(tree.span.attributes['method']).toEqual('findMany')
      expect(tree.span.attributes['model']).toEqual('User')

      expect(tree.children).toHaveLength(1)

      const engine = (tree?.children || [])[0] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:query_builder')

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:connection')

      if (provider === 'mongodb') {
        expect(engine.children).toHaveLength(2)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('db.User.findMany(*)')

        return
      }

      expect(engine.children).toHaveLength(2)

      const select = (engine.children || [])[1]
      expect(select.span.name).toEqual('prisma:db_query')
      expect(select.span.attributes['db.statement']).toContain('SELECT')
    })

    test('update', async () => {
      const newEmail = faker.internet.email()

      await prisma.user.update({
        data: {
          email: newEmail,
        },
        where: {
          email: email,
        },
      })

      email = newEmail

      const tree = await waitForSpanTree()

      expect(tree.span.name).toEqual('prisma')
      expect(tree.span.attributes['method']).toEqual('update')
      expect(tree.span.attributes['model']).toEqual('User')

      expect(tree.children).toHaveLength(1)

      const engine = (tree?.children || [])[0] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:query_builder')

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:connection')

      if (provider === 'mongodb') {
        expect(engine.children).toHaveLength(4)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('db.User.findMany(*)')

        const dbQuery2 = (engine.children || [])[2]
        expect(dbQuery2.span.name).toEqual('prisma:db_query')
        expect(dbQuery2.span.attributes['db.statement']).toContain('db.User.updateMany(*)')

        const dbQuery3 = (engine.children || [])[3]
        expect(dbQuery3.span.name).toEqual('prisma:db_query')
        expect(dbQuery3.span.attributes['db.statement']).toContain('db.User.findOne(*)')

        return
      }

      expect(engine.children).toHaveLength(6)

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toContain('BEGIN')

      const dbQuery2 = (engine.children || [])[2]
      expect(dbQuery2.span.name).toEqual('prisma:db_query')
      expect(dbQuery2.span.attributes['db.statement']).toContain('SELECT')

      const dbQuery3 = (engine.children || [])[3]
      expect(dbQuery3.span.name).toEqual('prisma:db_query')
      expect(dbQuery3.span.attributes['db.statement']).toContain('UPDATE')

      const dbQuery4 = (engine.children || [])[4]
      expect(dbQuery4.span.name).toEqual('prisma:db_query')
      expect(dbQuery4.span.attributes['db.statement']).toContain('SELECT')

      const dbQuery5 = (engine.children || [])[5]
      expect(dbQuery5.span.name).toEqual('prisma:db_query')
      expect(dbQuery5.span.attributes['db.statement']).toContain('COMMIT')
    })

    test('delete', async () => {
      await prisma.user.delete({
        where: {
          email: email,
        },
      })

      const tree = await waitForSpanTree()

      expect(tree.span.name).toEqual('prisma')
      expect(tree.span.attributes['method']).toEqual('delete')
      expect(tree.span.attributes['model']).toEqual('User')

      expect(tree.children).toHaveLength(1)

      const engine = (tree?.children || [])[0] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:query_builder')

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:connection')

      if (provider === 'mongodb') {
        expect(engine.children).toHaveLength(4)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('db.User.findOne(*)')

        const dbQuery2 = (engine.children || [])[2]
        expect(dbQuery2.span.name).toEqual('prisma:db_query')
        expect(dbQuery2.span.attributes['db.statement']).toContain('db.User.findMany(*)')

        const dbQuery3 = (engine.children || [])[3]
        expect(dbQuery3.span.name).toEqual('prisma:db_query')
        expect(dbQuery3.span.attributes['db.statement']).toContain('db.User.deleteMany(*)')

        return
      }

      expect(engine.children).toHaveLength(6)

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toContain('BEGIN')

      const dbQuery2 = (engine.children || [])[2]
      expect(dbQuery2.span.name).toEqual('prisma:db_query')
      expect(dbQuery2.span.attributes['db.statement']).toContain('SELECT')

      const dbQuery3 = (engine.children || [])[3]
      expect(dbQuery3.span.name).toEqual('prisma:db_query')
      expect(dbQuery3.span.attributes['db.statement']).toContain('SELECT')

      const dbQuery4 = (engine.children || [])[4]
      expect(dbQuery4.span.name).toEqual('prisma:db_query')
      expect(dbQuery4.span.attributes['db.statement']).toContain('DELETE')

      const dbQuery5 = (engine.children || [])[5]
      expect(dbQuery5.span.name).toEqual('prisma:db_query')
      expect(dbQuery5.span.attributes['db.statement']).toContain('COMMIT')
    })
  })

  describe('tracing on transactions', () => {
    test('$transaction', async () => {
      const email = faker.internet.email()

      await prisma.$transaction([
        prisma.user.create({
          data: {
            email,
          },
        }),
        prisma.user.findMany({
          where: {
            email,
          },
        }),
      ])

      const tree = await waitForSpanTree()

      expect(tree.span.name).toEqual('prisma:transaction')
      expect(tree.span.attributes['method']).toEqual('transaction')
      expect(tree.children).toHaveLength(1)

      const prismaSpan = (tree?.children || [])[0] as unknown as Tree
      expect(prismaSpan.span.name).toEqual('prisma')
      expect(prismaSpan.span.attributes['children']).toEqual(
        JSON.stringify([
          { method: 'create', model: 'User' },
          { method: 'findMany', model: 'User' },
        ]),
      )

      expect(prismaSpan.children).toHaveLength(1)

      const queryBuilder = (prismaSpan.children || [])[0] as unknown as Tree
      expect(queryBuilder.span.name).toEqual('prisma:query_builder')

      if (provider === 'mongodb') {
        expect(queryBuilder.children).toHaveLength(4)

        return
      }

      expect(queryBuilder.children).toHaveLength(6)
    })

    test('interactive-transactions', async () => {
      const email = faker.internet.email()

      // @ts-ignore
      await prisma.$transaction(async (client) => {
        await client.user.create({
          data: {
            email,
          },
        })
        await client.user.findMany({
          where: {
            email,
          },
        })
      })

      const tree = await waitForSpanTree()

      expect(tree.span.name).toEqual('prisma:transaction')
      expect(tree.span.attributes['method']).toEqual('transaction')
      expect(tree.children).toHaveLength(1)

      const prismaSpan = (tree?.children || [])[0] as unknown as Tree
      expect(prismaSpan.span.name).toEqual('prisma')
      expect(prismaSpan.span.attributes['children']).toEqual(
        JSON.stringify([
          { method: 'create', model: 'User' },
          { method: 'findMany', model: 'User' },
        ]),
      )

      expect(prismaSpan.children).toHaveLength(1)

      const prismaItxRunner = (prismaSpan?.children || [])[0] as unknown as Tree
      expect(prismaItxRunner.span.name).toEqual('prisma:itx_runner')

      const prismaGetConnection = (prismaItxRunner?.children || []).find(
        (child) => child.span.name === 'prisma:connection',
      ) as unknown as Tree
      expect(prismaGetConnection).toBeDefined()

      const [queryBuilder1, queryBuilder2] = (prismaItxRunner?.children || []).filter(
        (child) => child.span.name === 'prisma:itx_query_builder',
      ) as Tree[]

      expect(queryBuilder1).toBeDefined()
      expect(queryBuilder1.children).toHaveLength(2)

      expect(queryBuilder2).toBeDefined()
      expect(queryBuilder2.children).toHaveLength(1)

      if (provider === 'mongodb') {
        expect(prismaItxRunner.children).toHaveLength(3)

        return
      }

      expect(prismaItxRunner.children).toHaveLength(5)

      const begin = (prismaItxRunner?.children || []).find((child) =>
        child.span.attributes['db.statement']?.toString().includes('BEGIN'),
      ) as unknown as Tree
      expect(begin).toBeDefined()

      const commit = (prismaItxRunner?.children || []).find((child) =>
        child.span.attributes['db.statement']?.toString().includes('COMMIT'),
      ) as unknown as Tree
      expect(commit).toBeDefined()
    })
  })

  describe('tracing on $raw methods', () => {
    test('$queryRaw', async () => {
      if (provider === 'mongodb') {
        return
      }

      // @ts-test-if: provider !== 'mongodb'
      await prisma.$queryRaw`SELECT 1 + 1;`

      const tree = await waitForSpanTree()

      expect(tree.span.name).toEqual('prisma')
      expect(tree.span.attributes['method']).toEqual('queryRaw')

      expect(tree.children).toHaveLength(1)

      const engine = (tree?.children || [])[0] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:query_builder')

      expect(engine.children).toHaveLength(2)

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:connection')

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toEqual('SELECT 1 + 1;')
    })

    test('$executeRaw', async () => {
      // Raw query failed. Code: `N/A`. Message: `Execute returned results, which is not allowed in SQLite.`
      if (provider === 'sqlite' || provider === 'mongodb') {
        return
      }

      // @ts-test-if: provider !== 'mongodb'
      await prisma.$executeRaw`SELECT 1 + 1;`

      const tree = await waitForSpanTree()

      expect(tree.span.name).toEqual('prisma')
      expect(tree.span.attributes['method']).toEqual('executeRaw')

      expect(tree.children).toHaveLength(1)

      const engine = (tree?.children || [])[0] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:query_builder')

      expect(engine.children).toHaveLength(2)

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:connection')

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toEqual('SELECT 1 + 1;')
    })
  })

  test('tracing with custom span', async () => {
    const tracer = trace.getTracer('MyApp')
    const email = faker.internet.email()

    await tracer.startActiveSpan('create-user', async (span) => {
      try {
        return await prisma.user.create({
          data: {
            email: email,
          },
        })
      } finally {
        span.end()
      }
    })

    const tree = await waitForSpanTree()

    expect(tree.span.name).toEqual('create-user')

    const prismaSpan = (tree.children || [])[0]

    expect(prismaSpan.span.name).toEqual('prisma')
    expect(prismaSpan.span.attributes['method']).toEqual('create')
    expect(prismaSpan.span.attributes['model']).toEqual('User')

    expect(prismaSpan.children).toHaveLength(1)

    const engine = (prismaSpan?.children || [])[0] as unknown as Tree
    expect(engine.span.name).toEqual('prisma:query_builder')

    const getConnection = (engine.children || [])[0]
    expect(getConnection.span.name).toEqual('prisma:connection')

    if (provider === 'mongodb') {
      expect(engine.children).toHaveLength(3)

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toContain('db.User.insertOne(*)')

      const dbQuery2 = (engine.children || [])[2]
      expect(dbQuery2.span.name).toEqual('prisma:db_query')
      expect(dbQuery2.span.attributes['db.statement']).toContain('db.User.findOne(*)')

      return
    }

    expect(engine.children).toHaveLength(5)

    const dbQuery1 = (engine.children || [])[1]
    expect(dbQuery1.span.name).toEqual('prisma:db_query')
    expect(dbQuery1.span.attributes['db.statement']).toContain('BEGIN')

    const dbQuery2 = (engine.children || [])[2]
    expect(dbQuery2.span.name).toEqual('prisma:db_query')
    expect(dbQuery2.span.attributes['db.statement']).toContain('INSERT')

    const dbQuery3 = (engine.children || [])[3]
    expect(dbQuery3.span.name).toEqual('prisma:db_query')
    expect(dbQuery3.span.attributes['db.statement']).toContain('SELECT')

    const dbQuery4 = (engine.children || [])[4]
    expect(dbQuery4.span.name).toEqual('prisma:db_query')
    expect(dbQuery4.span.attributes['db.statement']).toContain('COMMIT')
  })

  describe('tracing with middleware', () => {
    // @ts-ignore
    let _prisma: PrismaClient

    beforeAll(() => {
      _prisma = new PrismaClient()
    })

    afterAll(async () => {
      await _prisma.$disconnect()
    })

    test('tracing with middleware', async () => {
      const email = faker.internet.email()

      _prisma.$use(async (params, next) => {
        // Manipulate params here
        const result = await next(params)
        // See results here
        return result
      })
      _prisma.$use(async (params, next) => {
        // Manipulate params here
        const result = await next(params)
        // See results here
        return result
      })

      await _prisma.user.create({
        data: {
          email: email,
        },
      })

      const tree = await waitForSpanTree()

      expect(tree.span.name).toEqual('prisma')
      expect(tree.span.attributes['method']).toEqual('create')
      expect(tree.span.attributes['model']).toEqual('User')

      expect(tree.children).toHaveLength(3)

      const middlewares = (tree.children || []).filter(({ span }) => span.name === 'prisma:middleware') as Tree[]
      expect(middlewares).toHaveLength(2)
      middlewares.forEach((m) => {
        expect(m.span.attributes['method']).toEqual('$use')
      })

      const engine = (tree.children || []).find(({ span }) => span.name === 'prisma:query_builder') as Tree

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:connection')

      if (provider === 'mongodb') {
        expect(engine.children).toHaveLength(3)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('db.User.insertOne(*)')

        const dbQuery2 = (engine.children || [])[2]
        expect(dbQuery2.span.name).toEqual('prisma:db_query')
        expect(dbQuery2.span.attributes['db.statement']).toContain('db.User.findOne(*)')

        return
      }

      expect(engine.children).toHaveLength(5)

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toContain('BEGIN')

      const dbQuery2 = (engine.children || [])[2]
      expect(dbQuery2.span.name).toEqual('prisma:db_query')
      expect(dbQuery2.span.attributes['db.statement']).toContain('INSERT')

      const dbQuery3 = (engine.children || [])[3]
      expect(dbQuery3.span.name).toEqual('prisma:db_query')
      expect(dbQuery3.span.attributes['db.statement']).toContain('SELECT')

      const dbQuery4 = (engine.children || [])[4]
      expect(dbQuery4.span.name).toEqual('prisma:db_query')
      expect(dbQuery4.span.attributes['db.statement']).toContain('COMMIT')
    })
  })
})
