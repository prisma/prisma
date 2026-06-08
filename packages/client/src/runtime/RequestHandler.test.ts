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

test('requests precomputed cached results directly', async () => {
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
    requestPrecomputedCachedResult: jest.fn().mockResolvedValue([{ id: 1 }]),
  }
  const handler = createRequestHandler(engine)

  await expect(
    handler.requestPrecomputedCachedResult({
      protocolQuery: query,
      modelName: 'User',
      action: 'findMany',
      dataPath: [],
      clientMethod: 'user.findMany',
      extensions,
      precomputedQueryPlanCacheHit,
    }),
  ).resolves.toEqual([{ id: 1 }])

  expect(engine.requestPrecomputedCachedResult).toHaveBeenCalledWith(
    query,
    precomputedQueryPlanCacheHit,
    expect.objectContaining({
      isWrite: false,
    }),
  )
})

test('maps direct precomputed cached result errors through request handling', async () => {
  const query: JsonQuery = {
    modelName: 'User',
    action: 'findMany',
    query: {
      selection: {
        id: true,
      },
    },
  }
  const engine = {
    requestPrecomputedCachedResult: jest.fn().mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed',
      meta: { target: ['id'] },
    }),
  }
  const handler = createRequestHandler(engine)

  await expect(
    handler.requestPrecomputedCachedResult({
      protocolQuery: query,
      modelName: 'User',
      action: 'findMany',
      dataPath: [],
      clientMethod: 'user.findMany',
      extensions,
      precomputedQueryPlanCacheHit: {
        cacheKey: 'cache-key',
        placeholderValues: { '%1': 1 },
      },
    }),
  ).rejects.toMatchObject({
    code: 'P2002',
    meta: {
      modelName: 'User',
      target: ['id'],
    },
  })
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

test('forwards precomputed query plan cache hits to batch requests', async () => {
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
  const firstPrecomputedQueryPlanCacheHit = {
    cacheKey: 'cache-key',
    placeholderValues: { '%1': 1 },
  }
  const secondPrecomputedQueryPlanCacheHit = {
    cacheKey: 'cache-key',
    placeholderValues: { '%1': 1 },
  }

  await Promise.all([
    handler.request({
      protocolQuery: query,
      modelName: 'User',
      action: 'findUnique',
      dataPath: [],
      clientMethod: 'user.findUnique',
      extensions,
      precomputedQueryPlanCacheHit: firstPrecomputedQueryPlanCacheHit,
    }),
    handler.request({
      protocolQuery: query,
      modelName: 'User',
      action: 'findUnique',
      dataPath: [],
      clientMethod: 'user.findUnique',
      extensions,
      precomputedQueryPlanCacheHit: secondPrecomputedQueryPlanCacheHit,
    }),
  ])

  expect(engine.requestBatch).toHaveBeenCalledWith(
    [query, query],
    expect.objectContaining({
      precomputedQueryPlanCacheHits: [firstPrecomputedQueryPlanCacheHit, secondPrecomputedQueryPlanCacheHit],
    }),
  )
})

test('does not forward partial precomputed query plan cache hits to batch requests', async () => {
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
    }),
  ])

  expect(engine.requestBatch).toHaveBeenCalledWith(
    [query, query],
    expect.not.objectContaining({
      precomputedQueryPlanCacheHits: expect.anything(),
    }),
  )
})

test('uses precomputed batch ids without walking the protocol query shape', async () => {
  const query: JsonQuery = {
    modelName: 'User',
    action: 'findUnique',
    query: undefined as any,
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
      precomputedBatchId: 'precomputed-batch-id',
    }),
    handler.request({
      protocolQuery: query,
      modelName: 'User',
      action: 'findUnique',
      dataPath: [],
      clientMethod: 'user.findUnique',
      extensions,
      precomputedBatchId: 'precomputed-batch-id',
    }),
  ])

  expect(engine.requestBatch).toHaveBeenCalledWith([query, query], expect.any(Object))
})
