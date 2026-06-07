import type { JsonQuery } from './core/engines'
import type { Client } from './getPrismaClient'
import { RequestHandler } from './RequestHandler'

const extensions = {
  getAllBatchQueryCallbacks: () => [],
} as any

function createRequestHandler(engine: unknown): RequestHandler {
  const client = {
    _engine: engine,
    _tracingHelper: {
      getTraceParent: () => undefined,
    },
    _clientVersion: '0.0.0',
    _errorFormat: 'minimal',
  } as unknown as Client

  return new RequestHandler(client)
}

test('unpack preserves native JSON values when deserialization is skipped', () => {
  const handler = Object.create(RequestHandler.prototype) as RequestHandler
  const jsonValue = { $type: 'DateTime', value: 'not a protocol value' }

  expect(handler.unpack({ findUnique: jsonValue }, [], undefined, true)).toBe(jsonValue)
  expect(
    handler.unpack(
      {
        findUnique: { $type: 'Json', value: JSON.stringify(jsonValue) },
      },
      [],
    ),
  ).toEqual(jsonValue)
})

test('forwards precomputed query plan cache hits to single requests', async () => {
  const query: JsonQuery = {
    modelName: 'User',
    action: 'findMany',
    query: {
      selection: {
        id: true,
      },
    },
  }
  const precomputedQueryPlanCacheHit = {
    cacheKey: 'cache-key',
    placeholderValues: { '%1': 1 },
  }
  const engine = {
    request: jest.fn().mockResolvedValue({ data: { findMany: [] } }),
  }
  const handler = createRequestHandler(engine)

  await handler.request({
    protocolQuery: query,
    modelName: 'User',
    action: 'findMany',
    dataPath: [],
    clientMethod: 'user.findMany',
    extensions,
    precomputedQueryPlanCacheHit,
  })

  expect(engine.request).toHaveBeenCalledWith(
    query,
    expect.objectContaining({
      precomputedQueryPlanCacheHit,
    }),
  )
})

test('does not forward precomputed query plan cache hits to batch requests', async () => {
  const query: JsonQuery = {
    modelName: 'User',
    action: 'findUnique',
    query: {
      arguments: {
        where: {
          id: 1,
        },
      },
      selection: {
        id: true,
      },
    },
  }
  const engine = {
    requestBatch: jest
      .fn()
      .mockResolvedValue([{ data: { findUnique: { id: 1 } } }, { data: { findUnique: { id: 1 } } }]),
  }
  const handler = createRequestHandler(engine)

  await Promise.all([
    handler.request({
      protocolQuery: query,
      modelName: 'User',
      action: 'findUnique',
      dataPath: [],
      clientMethod: 'user.findUnique',
      extensions,
      precomputedQueryPlanCacheHit: {
        cacheKey: 'cache-key',
        placeholderValues: { '%1': 1 },
      },
    }),
    handler.request({
      protocolQuery: query,
      modelName: 'User',
      action: 'findUnique',
      dataPath: [],
      clientMethod: 'user.findUnique',
      extensions,
      precomputedQueryPlanCacheHit: {
        cacheKey: 'cache-key',
        placeholderValues: { '%1': 1 },
      },
    }),
  ])

  expect(engine.requestBatch).toHaveBeenCalledWith(
    [query, query],
    expect.not.objectContaining({
      precomputedQueryPlanCacheHit: expect.anything(),
    }),
  )
})
