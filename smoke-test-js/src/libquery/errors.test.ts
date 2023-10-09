import { bindAdapter } from '@prisma/driver-adapter-utils'
import test, { after, before, describe } from 'node:test'
import { createQueryFn, initQueryEngine, throwAdapterError } from './util'
import assert from 'node:assert'

const fakeAdapter = bindAdapter({
  flavour: 'postgres',
  startTransaction() {
    throw new Error('Error in startTransaction')
  },

  queryRaw() {
    throw new Error('Error in queryRaw')
  },

  executeRaw() {
    throw new Error('Error in executeRaw')
  },
  close() {
    return Promise.resolve({ ok: true, value: undefined })
  },
})

const engine = initQueryEngine(fakeAdapter, '../../prisma/postgres/schema.prisma')
const doQuery = createQueryFn(engine, fakeAdapter)

const startTransaction = async () => {
  const args = { isolation_level: 'Serializable', max_wait: 5000, timeout: 15000 }
  const res = JSON.parse(await engine.startTransaction(JSON.stringify(args), '{}'))
  if (res['error_code']) {
    throwAdapterError(res, fakeAdapter)
  }
}

describe('errors propagation', () => {
  before(async () => {
    await engine.connect('{}')
  })
  after(async () => {
    await engine.disconnect('{}')
  })

  test('works for queries', async () => {
    await assert.rejects(
      doQuery({
        modelName: 'Product',
        action: 'findMany',
        query: {
          arguments: {},
          selection: {
            $scalars: true,
          },
        },
      }),
      /Error in queryRaw/,
    )
  })

  test('works for executeRaw', async () => {
    await assert.rejects(
      doQuery({
        action: 'executeRaw',
        query: {
          arguments: {
            query: 'SELECT 1',
            parameters: '[]',
          },
          selection: {
            $scalars: true,
          },
        },
      }),
      /Error in executeRaw/,
    )
  })

  test('works with implicit transaction', async () => {
    await assert.rejects(
      doQuery({
        modelName: 'User',
        action: 'createOne',
        query: {
          arguments: {
            data: {
              email: 'user@example.com',
              favoriteProduct: {
                create: {
                  properties: {},
                },
              },
            },
          },
          selection: {
            $scalars: true,
          },
        },
      }),
      /Error in startTransaction/,
    )
  })

  test('works with explicit transaction', async () => {
    await assert.rejects(startTransaction(), /Error in startTransaction/)
  })
})
