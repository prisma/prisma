import { faker } from '@faker-js/faker'
import { context, trace } from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

type Tree = {
  span: ReadableSpan
  children?: Tree[]
}

function buildTree(tree: Tree, spans: ReadableSpan[]): Tree {
  const childrenSpans = spans.filter((span) => span.parentSpanId === tree.span.spanContext().spanId)
  if (childrenSpans.length) {
    tree.children = childrenSpans
      .sort((a, b) => {
        // Ensures fixed order of children spans regardless of the
        // actual timings. Why use name instead of start time? Sometimes
        // things happen in parallel/different order and startTime does not
        // provide stable ordering guarantee.
        return a.name.localeCompare(b.name)
      })
      .map((span) => buildTree({ span }, spans))
  } else {
    tree.children = []
  }

  // Remove unused keys for easier debugging
  const simpleTree = JSON.stringify(
    tree,
    (key, value) => {
      if (key === '_duration') {
        const [, duration] = value as unknown as [number, number]

        // https://github.com/prisma/prisma/issues/14614
        // This number should always be greater than 0
        if (duration === 0) {
          throw new Error('span duration should contain high res time')
        }

        return undefined
      }

      const removedKeys = [
        'endTime',
        '_ended',
        '_spanContext',
        'startTime',
        'resource',
        '_spanLimits',
        'status',
        'events',
        'instrumentationLibrary',
        '_spanProcessor',
        '_attributeValueLengthLimit',
        '_duration',
      ]

      if (removedKeys.includes(key)) {
        return undefined
      } else {
        return value
      }
    },
    2,
  )

  return JSON.parse(simpleTree)
}

declare let prisma: PrismaClient
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

let inMemorySpanExporter: InMemorySpanExporter

beforeAll(() => {
  const contextManager = new AsyncHooksContextManager().enable()
  context.setGlobalContextManager(contextManager)

  inMemorySpanExporter = new InMemorySpanExporter()

  const basicTracerProvider = new BasicTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: `test-name`,
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    }),
  })

  basicTracerProvider.addSpanProcessor(new SimpleSpanProcessor(inMemorySpanExporter))
  basicTracerProvider.register()

  registerInstrumentations({
    instrumentations: [new PrismaInstrumentation({ middleware: true })],
  })
})

afterAll(() => {
  context.disable()
})

testMatrix.setupTestSuite(({ provider }, suiteMeta, clientMeta) => {
  beforeEach(async () => {
    await prisma.$connect()
    inMemorySpanExporter.reset()
  })

  function cleanSpanTreeForSnapshot(tree: Tree) {
    return JSON.parse(JSON.stringify(tree), (key, value) => {
      if (key[0] === '_') return undefined
      if (key === 'parentSpanId') return '<parentSpanId>'
      if (key === 'itx_id') return '<itxId>'
      if (key === 'endTime') return '<endTime>'
      if (key === 'startTime') return '<startTime>'
      if (key === 'db.type') return '<dbType>'
      if (key === 'db.statement') return '<dbStatement>'
      if (key === 'resource') return undefined
      if (key === 'spanId') return '<spanId>'
      if (key === 'traceId') return '<traceId>'

      return value
    })
  }

  async function waitForSpanTree(): Promise<Tree> {
    /*
      Spans come through logs and sometimes these tests can be flaky without
      giving some buffer
    */
    await new Promise((resolve) => setTimeout(resolve, 500))

    const spans = inMemorySpanExporter.getFinishedSpans()
    const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
    const tree = buildTree({ span: rootSpan }, spans)

    return tree
  }

  describe('tracing on crud methods', () => {
    let sharedEmail = faker.internet.email()

    test('create', async () => {
      await prisma.user.create({
        data: {
          email: sharedEmail,
        },
      })

      const tree = await waitForSpanTree()

      expect(cleanSpanTreeForSnapshot(tree)).toMatchSnapshot()

      expect(tree.span.name).toEqual('prisma:client:operation')
      expect(tree.span.attributes['method']).toEqual('create')
      expect(tree.span.attributes['model']).toEqual('User')

      expect(tree.children).toHaveLength(2)

      const serialize = (tree?.children || [])[0] as unknown as Tree
      expect(serialize.span.name).toEqual('prisma:client:serialize')

      const engine = (tree?.children || [])[1] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:engine')

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:engine:connection')

      if (provider === 'mongodb') {
        expect(engine.children).toHaveLength(4)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('db.User.insertOne(*)')

        const dbQuery2 = (engine.children || [])[2]
        expect(dbQuery2.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery2.span.attributes['db.statement']).toContain('db.User.findOne(*)')

        const engineSerialize = (engine.children || [])[3]
        expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')

        return
      } // Since https://github.com/prisma/prisma-engines/pull/4041
      // We skip a read when possible, on CockroachDB and PostgreSQL
      else if (['postgresql', 'cockroachdb'].includes(provider)) {
        expect(engine.children).toHaveLength(3)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('INSERT')

        const engineSerialize = (engine.children || [])[2]
        expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')
      } else {
        expect(engine.children).toHaveLength(6)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('BEGIN')

        const dbQuery2 = (engine.children || [])[2]
        expect(dbQuery2.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery2.span.attributes['db.statement']).toContain('INSERT')

        const dbQuery3 = (engine.children || [])[3]
        expect(dbQuery3.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery3.span.attributes['db.statement']).toContain('SELECT')

        const dbQuery4 = (engine.children || [])[4]
        expect(dbQuery4.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery4.span.attributes['db.statement']).toContain('COMMIT')

        const engineSerialize = (engine.children || [])[5]
        expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')
      }
    })

    test('read', async () => {
      await prisma.user.findMany({
        where: {
          email: sharedEmail,
        },
      })

      const tree = await waitForSpanTree()

      expect(cleanSpanTreeForSnapshot(tree)).toMatchSnapshot()

      expect(tree.span.name).toEqual('prisma:client:operation')
      expect(tree.span.attributes['method']).toEqual('findMany')
      expect(tree.span.attributes['model']).toEqual('User')

      expect(tree.children).toHaveLength(2)

      const serialize = (tree?.children || [])[0] as unknown as Tree
      expect(serialize.span.name).toEqual('prisma:client:serialize')

      const engine = (tree?.children || [])[1] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:engine')

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:engine:connection')

      if (provider === 'mongodb') {
        expect(engine.children).toHaveLength(3)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('db.User.findMany(*)')

        const engineSerialize = (engine.children || [])[2]
        expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')

        return
      }

      expect(engine.children).toHaveLength(3)

      const select = (engine.children || [])[1]
      expect(select.span.name).toEqual('prisma:engine:db_query')
      expect(select.span.attributes['db.statement']).toContain('SELECT')

      const engineSerialize = (engine.children || [])[2]
      expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')
    })

    test('update', async () => {
      const newEmail = faker.internet.email()

      await prisma.user.update({
        data: {
          email: newEmail,
        },
        where: {
          email: sharedEmail,
        },
      })

      sharedEmail = newEmail

      const tree = await waitForSpanTree()

      expect(cleanSpanTreeForSnapshot(tree)).toMatchSnapshot()

      expect(tree.span.name).toEqual('prisma:client:operation')
      expect(tree.span.attributes['method']).toEqual('update')
      expect(tree.span.attributes['model']).toEqual('User')

      expect(tree.children).toHaveLength(2)

      const serialize = (tree?.children || [])[0] as unknown as Tree
      expect(serialize.span.name).toEqual('prisma:client:serialize')

      const engine = (tree?.children || [])[1] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:engine')

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:engine:connection')

      if (provider === 'mongodb') {
        expect(engine.children).toHaveLength(5)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('db.User.findMany(*)')

        const dbQuery2 = (engine.children || [])[2]
        expect(dbQuery2.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery2.span.attributes['db.statement']).toContain('db.User.updateMany(*)')

        const dbQuery3 = (engine.children || [])[3]
        expect(dbQuery3.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery3.span.attributes['db.statement']).toContain('db.User.findOne(*)')

        const engineSerialize = (engine.children || [])[4]
        expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')

        return
      }

      if (['postgresql', 'cockroachdb'].includes(provider)) {
        expect(engine.children).toHaveLength(3)

        const dbQuery3 = (engine.children || [])[1]
        expect(dbQuery3.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery3.span.attributes['db.statement']).toContain('UPDATE')

        const engineSerialize = (engine.children || [])[2]
        expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')

        return
      }

      expect(engine.children).toHaveLength(7)

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toContain('BEGIN')

      const dbQuery2 = (engine.children || [])[2]
      expect(dbQuery2.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery2.span.attributes['db.statement']).toContain('SELECT')

      const dbQuery3 = (engine.children || [])[3]
      expect(dbQuery3.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery3.span.attributes['db.statement']).toContain('UPDATE')

      const dbQuery4 = (engine.children || [])[4]
      expect(dbQuery4.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery4.span.attributes['db.statement']).toContain('SELECT')

      const dbQuery5 = (engine.children || [])[5]
      expect(dbQuery5.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery5.span.attributes['db.statement']).toContain('COMMIT')

      const engineSerialize = (engine.children || [])[6]
      expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')
    })

    test('delete', async () => {
      await prisma.user.delete({
        where: {
          email: sharedEmail,
        },
      })

      const tree = await waitForSpanTree()

      expect(cleanSpanTreeForSnapshot(tree)).toMatchSnapshot()

      expect(tree.span.name).toEqual('prisma:client:operation')
      expect(tree.span.attributes['method']).toEqual('delete')
      expect(tree.span.attributes['model']).toEqual('User')

      expect(tree.children).toHaveLength(2)

      const serialize = (tree?.children || [])[0] as unknown as Tree
      expect(serialize.span.name).toEqual('prisma:client:serialize')

      const engine = (tree?.children || [])[1] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:engine')

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:engine:connection')

      if (provider === 'mongodb') {
        expect(engine.children).toHaveLength(5)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('db.User.findOne(*)')

        const dbQuery2 = (engine.children || [])[2]
        expect(dbQuery2.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery2.span.attributes['db.statement']).toContain('db.User.findMany(*)')

        const dbQuery3 = (engine.children || [])[3]
        expect(dbQuery3.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery3.span.attributes['db.statement']).toContain('db.User.deleteMany(*)')

        const engineSerialize = (engine.children || [])[4]
        expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')

        return
      }

      expect(engine.children).toHaveLength(7)

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toContain('BEGIN')

      const dbQuery2 = (engine.children || [])[2]
      expect(dbQuery2.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery2.span.attributes['db.statement']).toContain('SELECT')

      const dbQuery3 = (engine.children || [])[3]
      expect(dbQuery3.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery3.span.attributes['db.statement']).toContain('SELECT')

      const dbQuery4 = (engine.children || [])[4]
      expect(dbQuery4.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery4.span.attributes['db.statement']).toContain('DELETE')

      const dbQuery5 = (engine.children || [])[5]
      expect(dbQuery5.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery5.span.attributes['db.statement']).toContain('COMMIT')

      const engineSerialize = (engine.children || [])[6]
      expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')
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

      expect(cleanSpanTreeForSnapshot(tree)).toMatchSnapshot()

      expect(tree.span.name).toEqual('prisma:client:transaction')
      expect(tree.span.attributes['method']).toEqual('$transaction')
      expect(tree.children).toHaveLength(3)

      const create = (tree?.children || [])[0] as unknown as Tree
      expect(create.span.name).toEqual('prisma:client:operation')
      expect(create.span.attributes.model).toEqual('User')
      expect(create.span.attributes.method).toEqual('create')

      const findMany = (tree?.children || [])[1] as unknown as Tree
      expect(findMany.span.name).toEqual('prisma:client:operation')
      expect(findMany.span.attributes.model).toEqual('User')
      expect(findMany.span.attributes.method).toEqual('findMany')

      const queryBuilder = (tree?.children || [])[2] as unknown as Tree
      expect(queryBuilder.span.name).toEqual('prisma:engine')

      if (provider === 'mongodb') {
        expect(queryBuilder.children).toHaveLength(6)
        return
      }
      // Since https://github.com/prisma/prisma-engines/pull/4041
      // We skip a read when possible, on CockroachDB and PostgreSQL
      else if (['postgresql', 'cockroachdb'].includes(provider)) {
        expect(queryBuilder.children).toHaveLength(7)
      } else {
        expect(queryBuilder.children).toHaveLength(8)
      }
    })

    test('interactive-transactions', async () => {
      const email = faker.internet.email()

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

      expect(cleanSpanTreeForSnapshot(tree)).toMatchSnapshot()

      expect(tree.span.name).toEqual('prisma:client:transaction')
      expect(tree.span.attributes['method']).toEqual('$transaction')
      expect(tree.children).toHaveLength(3)

      const create = (tree?.children || [])[0] as unknown as Tree
      expect(create.span.name).toEqual('prisma:client:operation')
      expect(create.span.attributes.model).toEqual('User')
      expect(create.span.attributes.method).toEqual('create')

      const findMany = (tree?.children || [])[1] as unknown as Tree
      expect(findMany.span.name).toEqual('prisma:client:operation')
      expect(findMany.span.attributes.model).toEqual('User')
      expect(findMany.span.attributes.method).toEqual('findMany')

      const itxRunner = (tree?.children || [])[2] as unknown as Tree
      expect(itxRunner.span.name).toEqual('prisma:engine:itx_runner')

      if (provider === 'mongodb') {
        expect(itxRunner.children).toHaveLength(3)

        return
      }

      expect(itxRunner.children).toHaveLength(5)
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

      expect(cleanSpanTreeForSnapshot(tree)).toMatchSnapshot()

      expect(tree.span.name).toEqual('prisma:client:operation')
      expect(tree.span.attributes['method']).toEqual('queryRaw')

      expect(tree.children).toHaveLength(2)

      const serialize = (tree?.children || [])[0] as unknown as Tree
      expect(serialize.span.name).toEqual('prisma:client:serialize')

      const engine = (tree?.children || [])[1] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:engine')

      expect(engine.children).toHaveLength(3)

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:engine:connection')

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toEqual('SELECT 1 + 1;')

      const engineSerialize = (engine.children || [])[2]
      expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')
    })

    test('$executeRaw', async () => {
      // Raw query failed. Code: `N/A`. Message: `Execute returned results, which is not allowed in SQLite.`
      if (provider === 'sqlite' || provider === 'mongodb') {
        return
      }

      // @ts-test-if: provider !== 'mongodb'
      await prisma.$executeRaw`SELECT 1 + 1;`

      const tree = await waitForSpanTree()

      expect(cleanSpanTreeForSnapshot(tree)).toMatchSnapshot()

      expect(tree.span.name).toEqual('prisma:client:operation')
      expect(tree.span.attributes['method']).toEqual('executeRaw')

      expect(tree.children).toHaveLength(2)

      const serialize = (tree?.children || [])[0] as unknown as Tree
      expect(serialize.span.name).toEqual('prisma:client:serialize')

      const engine = (tree?.children || [])[1] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:engine')

      expect(engine.children).toHaveLength(3)

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:engine:connection')

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toEqual('SELECT 1 + 1;')

      const engineSerialize = (engine.children || [])[2]
      expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')
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

    expect(cleanSpanTreeForSnapshot(tree)).toMatchSnapshot()

    expect(tree.span.name).toEqual('create-user')

    const prismaSpan = (tree.children || [])[0]
    expect(prismaSpan.span.name).toEqual('prisma:client:operation')
    expect(prismaSpan.span.attributes['method']).toEqual('create')
    expect(prismaSpan.span.attributes['model']).toEqual('User')
    expect(prismaSpan.children).toHaveLength(2)

    const serialize = (prismaSpan?.children || [])[0] as unknown as Tree
    expect(serialize.span.name).toEqual('prisma:client:serialize')

    const engine = (prismaSpan?.children || [])[1] as unknown as Tree
    expect(engine.span.name).toEqual('prisma:engine')

    const getConnection = (engine.children || [])[0]
    expect(getConnection.span.name).toEqual('prisma:engine:connection')

    if (provider === 'mongodb') {
      expect(engine.children).toHaveLength(4)

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toContain('db.User.insertOne(*)')

      const dbQuery2 = (engine.children || [])[2]
      expect(dbQuery2.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery2.span.attributes['db.statement']).toContain('db.User.findOne(*)')

      const engineSerialize = (engine.children || [])[3]
      expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')

      return
    } // Since https://github.com/prisma/prisma-engines/pull/4041
    // We skip a read when possible, on CockroachDB and PostgreSQL
    else if (['postgresql', 'cockroachdb'].includes(provider)) {
      expect(engine.children).toHaveLength(3)

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toContain('INSERT')

      const engineSerialize = (engine.children || [])[2]
      expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')
    } else {
      expect(engine.children).toHaveLength(6)

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toContain('BEGIN')

      const dbQuery2 = (engine.children || [])[2]
      expect(dbQuery2.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery2.span.attributes['db.statement']).toContain('INSERT')

      const dbQuery3 = (engine.children || [])[3]
      expect(dbQuery3.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery3.span.attributes['db.statement']).toContain('SELECT')

      const dbQuery4 = (engine.children || [])[4]
      expect(dbQuery4.span.name).toEqual('prisma:engine:db_query')
      expect(dbQuery4.span.attributes['db.statement']).toContain('COMMIT')

      const engineSerialize = (engine.children || [])[5]
      expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')
    }
  })

  describe('tracing with middleware', () => {
    let _prisma: PrismaClient

    beforeAll(async () => {
      _prisma = newPrismaClient()

      await _prisma.$connect()
    })

    test('should succeed', async () => {
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

      expect(cleanSpanTreeForSnapshot(tree)).toMatchSnapshot()

      expect(tree.span.name).toEqual('prisma:client:operation')
      expect(tree.span.attributes['method']).toEqual('create')
      expect(tree.span.attributes['model']).toEqual('User')

      expect(tree.children).toHaveLength(4)

      const middleware1 = (tree.children || [])[0] as unknown as Tree
      expect(middleware1.span.name).toEqual('prisma:client:middleware')
      expect(middleware1.children).toHaveLength(0)

      const middleware2 = (tree.children || [])[1] as unknown as Tree
      expect(middleware2.span.name).toEqual('prisma:client:middleware')
      expect(middleware2.children).toHaveLength(0)

      const engine = (tree.children || []).find(({ span }) => span.name === 'prisma:engine') as Tree

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:engine:connection')

      if (provider === 'mongodb') {
        expect(engine.children).toHaveLength(4)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('db.User.insertOne(*)')

        const dbQuery2 = (engine.children || [])[2]
        expect(dbQuery2.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery2.span.attributes['db.statement']).toContain('db.User.findOne(*)')

        const serialize = (engine.children || [])[3]
        expect(serialize.span.name).toEqual('prisma:engine:serialize')

        return
      }
      // Since https://github.com/prisma/prisma-engines/pull/4041
      // We skip a read when possible, on CockroachDB and PostgreSQL
      else if (['postgresql', 'cockroachdb'].includes(provider)) {
        expect(engine.children).toHaveLength(3)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('INSERT')

        const serialize = (engine.children || [])[2]
        expect(serialize.span.name).toEqual('prisma:engine:serialize')
      } else {
        expect(engine.children).toHaveLength(6)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('BEGIN')

        const dbQuery2 = (engine.children || [])[2]
        expect(dbQuery2.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery2.span.attributes['db.statement']).toContain('INSERT')

        const dbQuery3 = (engine.children || [])[3]
        expect(dbQuery3.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery3.span.attributes['db.statement']).toContain('SELECT')

        const dbQuery4 = (engine.children || [])[4]
        expect(dbQuery4.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery4.span.attributes['db.statement']).toContain('COMMIT')

        const serialize = (engine.children || [])[5]
        expect(serialize.span.name).toEqual('prisma:engine:serialize')
      }
    })
  })

  // $connect is a no-op with Data Proxy
  describeIf(!clientMeta.dataProxy)('tracing connect', () => {
    let _prisma: PrismaClient

    beforeEach(() => {
      _prisma = newPrismaClient()
    })

    afterEach(async () => {
      await _prisma.$disconnect()
    })

    // Different order of traces between binary and library
    test('should trace the implicit $connect call', async () => {
      const email = faker.internet.email()

      await _prisma.user.findMany({
        where: {
          email: email,
        },
      })

      const tree = await waitForSpanTree()

      expect(tree.span.name).toEqual('prisma:client:operation')
      expect(tree.span.attributes['method']).toEqual('findMany')
      expect(tree.span.attributes['model']).toEqual('User')

      expect(tree.children).toHaveLength(3)
      const connect: Tree | undefined = tree?.children?.[0]
      const serialize: Tree | undefined = tree?.children?.[1]

      expect(connect?.span.name).toEqual('prisma:client:connect')

      expect(serialize?.span.name).toEqual('prisma:client:serialize')

      expect(connect?.children).toHaveLength(0)

      const engine = (tree?.children || [])[2] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:engine')

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:engine:connection')

      if (provider === 'mongodb') {
        expect(engine.children).toHaveLength(3)

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:engine:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toContain('db.User.findMany(*)')

        const engineSerialize = (engine.children || [])[2]
        expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')

        return
      }

      expect(engine.children).toHaveLength(3)

      const select = (engine.children || [])[1]
      expect(select.span.name).toEqual('prisma:engine:db_query')
      expect(select.span.attributes['db.statement']).toContain('SELECT')

      const engineSerialize = (engine.children || [])[2]
      expect(engineSerialize.span.name).toEqual('prisma:engine:serialize')
    })
  })

  // $disconnect is a no-op with Data Proxy
  describeIf(!clientMeta.dataProxy)('tracing disconnect', () => {
    let _prisma: PrismaClient

    beforeAll(async () => {
      _prisma = newPrismaClient()
      await _prisma.$connect()
    })

    test('should trace $disconnect', async () => {
      await _prisma.$disconnect()

      const tree = await waitForSpanTree()

      expect(tree.span.name).toEqual('prisma:client:disconnect')
    })
  })
})
