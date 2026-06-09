import type { DescriptorBoundMatcherRegistry } from '@prisma/client-common'

import { field, model, runtimeDataModel } from '../../../testUtils/dataModelBuilder'
import type { Client } from '../../getPrismaClient'
import { MergedExtensionsList } from '../extensions/MergedExtensionsList'
import { applyModel } from './applyModel'
import { createExactDescriptorMatcherRegistry } from './createExactDescriptorMatcherRegistry'

const datamodel = runtimeDataModel({
  models: [model('User', [field('scalar', 'email', 'String'), field('scalar', 'name', 'String')])],
})

function createClient({
  descriptorMatcherRegistry,
  placeholderValues = { '%1': '1' },
  precomputedHits,
}: {
  descriptorMatcherRegistry?: DescriptorBoundMatcherRegistry
  placeholderValues?: Record<string, unknown>
  precomputedHits?: Array<{ cacheKey: string; placeholderValues: Record<string, unknown> }>
} = {}) {
  const pendingHits = precomputedHits?.slice()
  const engine = {
    getPrecomputedQueryPlanCacheHit: jest.fn(() => {
      if (pendingHits !== undefined) {
        return pendingHits.shift()
      }

      return {
        cacheKey: 'cache-key',
        placeholderValues,
      }
    }),
  }
  const requestHandler = {
    request: jest.fn().mockResolvedValue({ id: 'result' }),
  }
  const client = {
    _runtimeDataModel: datamodel,
    _extensions: MergedExtensionsList.empty(),
    _appliedParent: undefined,
    _createPrismaPromise: (callback: (transaction: undefined) => unknown) => {
      const promise = Promise.resolve().then(() => callback(undefined))
      return {
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),
        finally: promise.finally.bind(promise),
        requestTransaction: jest.fn(),
      }
    },
    _enginePrecomputedFastPath: false,
    _requestPrecomputedFastPath: true,
    _descriptorMatcherRegistry: descriptorMatcherRegistry,
    _globalOmit: undefined,
    _tracingHelper: { isEnabled: () => false },
    _isClientDebugEnabled: () => false,
    _engineConfig: {
      adapter: {},
      sqlCommenters: undefined,
    },
    _engine: engine,
    _requestHandler: requestHandler,
    _errorFormat: 'minimal',
    _clientVersion: '0.0.0',
    _previewFeatures: [],
  } as unknown as Client

  return {
    client,
    engine,
    requestHandler,
    user: applyModel(client, 'User') as any,
  }
}

test('binds a descriptor matcher after self-test reproduces slow-path placeholders', async () => {
  const matcher = jest.fn((args: unknown) => {
    if (!isRecord(args) || !isRecord(args.where)) {
      return undefined
    }
    return { '%1': args.where.id }
  })
  const getMatcher = jest.fn(() => matcher)
  const registry: DescriptorBoundMatcherRegistry = {
    getMatcher,
  }
  const { engine, requestHandler, user } = createClient({ descriptorMatcherRegistry: registry })

  await user.findUnique({ where: { id: '1' }, select: { id: true } })
  await user.findUnique({ where: { id: '2' }, select: { id: true } })

  expect(getMatcher).toHaveBeenCalledTimes(1)
  expect(matcher).toHaveBeenCalledTimes(2)
  expect(engine.getPrecomputedQueryPlanCacheHit).toHaveBeenCalledTimes(1)
  expect(requestHandler.request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      precomputedQueryPlanCacheHit: expect.objectContaining({
        placeholderValues: { '%1': '2' },
      }),
    }),
  )
})

test('does not store a descriptor matcher when self-test changes placeholder key order', async () => {
  const matcher = jest.fn(() => {
    const placeholderValues: Record<string, unknown> = {}
    placeholderValues['%2'] = 'Alice'
    placeholderValues['%1'] = '1'
    return placeholderValues
  })
  const getMatcher = jest.fn(() => matcher)
  const registry: DescriptorBoundMatcherRegistry = {
    getMatcher,
  }
  const { engine, requestHandler, user } = createClient({
    descriptorMatcherRegistry: registry,
    placeholderValues: { '%1': '1', '%2': 'Alice' },
  })

  await user.findUnique({ where: { id: '1', name: 'Alice' }, select: { id: true } })
  await user.findUnique({ where: { id: '2', name: 'Bob' }, select: { id: true } })

  expect(getMatcher).toHaveBeenCalledTimes(1)
  expect(matcher).toHaveBeenCalledTimes(1)
  expect(engine.getPrecomputedQueryPlanCacheHit).toHaveBeenCalledTimes(1)

  const secondHit = requestHandler.request.mock.calls[1][0].precomputedQueryPlanCacheHit as {
    placeholderValues: Record<string, unknown>
  }
  expect(Object.keys(secondHit.placeholderValues)).toEqual(['%1', '%2'])
  expect(secondHit.placeholderValues).toEqual({ '%1': '2', '%2': 'Bob' })
})

test('falls back to the lazy descriptor when a stored matcher misses later args', async () => {
  const matcher = jest.fn((args: unknown) => {
    if (!isRecord(args) || !isRecord(args.where) || args.where.id !== '1') {
      return undefined
    }
    return { '%1': args.where.id }
  })
  const getMatcher = jest.fn(() => matcher)
  const registry: DescriptorBoundMatcherRegistry = {
    getMatcher,
  }
  const { engine, requestHandler, user } = createClient({ descriptorMatcherRegistry: registry })

  await user.findUnique({ where: { id: '1' }, select: { id: true } })
  await user.findUnique({ where: { id: '2' }, select: { id: true } })

  expect(getMatcher).toHaveBeenCalledTimes(1)
  expect(matcher).toHaveBeenCalledTimes(2)
  expect(engine.getPrecomputedQueryPlanCacheHit).toHaveBeenCalledTimes(1)
  expect(requestHandler.request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      precomputedQueryPlanCacheHit: expect.objectContaining({
        placeholderValues: { '%1': '2' },
      }),
    }),
  )
})

test('keeps two descriptor-bound matchers for alternating shapes', async () => {
  const idMatcher = jest.fn((args: unknown) => {
    if (!isRecord(args) || !isRecord(args.where) || typeof args.where.id !== 'string') {
      return undefined
    }
    return { '%1': args.where.id }
  })
  const nameMatcher = jest.fn((args: unknown) => {
    if (!isRecord(args) || !isRecord(args.where) || typeof args.where.name !== 'string') {
      return undefined
    }
    return { '%1': args.where.name }
  })
  const getMatcher = jest.fn((context: Parameters<DescriptorBoundMatcherRegistry['getMatcher']>[0]) => {
    const { precomputedQueryPlanCacheHit } = context
    if (precomputedQueryPlanCacheHit.cacheKey === 'id-cache-key') {
      return idMatcher
    }
    if (precomputedQueryPlanCacheHit.cacheKey === 'name-cache-key') {
      return nameMatcher
    }
    return undefined
  })
  const registry: DescriptorBoundMatcherRegistry = {
    getMatcher,
  }
  const { engine, requestHandler, user } = createClient({
    descriptorMatcherRegistry: registry,
    precomputedHits: [
      { cacheKey: 'id-cache-key', placeholderValues: { '%1': '1' } },
      { cacheKey: 'name-cache-key', placeholderValues: { '%1': 'Alice' } },
    ],
  })

  await user.findUnique({ where: { id: '1' }, select: { id: true } })
  await user.findUnique({ where: { name: 'Alice' }, select: { id: true } })
  await user.findUnique({ where: { id: '2' }, select: { id: true } })
  await user.findUnique({ where: { name: 'Bob' }, select: { id: true } })

  expect(getMatcher).toHaveBeenCalledTimes(2)
  expect(engine.getPrecomputedQueryPlanCacheHit).toHaveBeenCalledTimes(2)
  expect(requestHandler.request.mock.calls[2][0].precomputedQueryPlanCacheHit).toEqual(
    expect.objectContaining({
      cacheKey: 'id-cache-key',
      placeholderValues: { '%1': '2' },
    }),
  )
  expect(requestHandler.request.mock.calls[3][0].precomputedQueryPlanCacheHit).toEqual(
    expect.objectContaining({
      cacheKey: 'name-cache-key',
      placeholderValues: { '%1': 'Bob' },
    }),
  )
})

test('stores the runtime exact descriptor matcher after slow-path parity self-test', async () => {
  const { registry, getMatcher, matchers } = createSpiedExactRegistry()
  const { engine, requestHandler, user } = createClient({ descriptorMatcherRegistry: registry })

  await user.findUnique({ where: { id: '1' }, select: { id: true, email: true, name: true } })
  await user.findUnique({ where: { id: '2' }, select: { id: true, email: true, name: true } })

  expect(getMatcher).toHaveBeenCalledTimes(1)
  expect(matchers).toHaveLength(1)
  expect(matchers[0]).toHaveBeenCalledTimes(2)
  expect(engine.getPrecomputedQueryPlanCacheHit).toHaveBeenCalledTimes(1)
  expect(requestHandler.request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      precomputedQueryPlanCacheHit: expect.objectContaining({
        placeholderValues: { '%1': '2' },
      }),
    }),
  )
})

test('falls back to the lazy descriptor when the runtime exact matcher misses later args', async () => {
  const { registry, getMatcher, matchers } = createSpiedExactRegistry()
  const { engine, requestHandler, user } = createClient({ descriptorMatcherRegistry: registry })

  await user.findUnique({ where: { id: '1' }, select: { id: true, email: true, name: true } })
  await user.findUnique({ select: { id: true, email: true, name: true }, where: { id: '2' } })

  expect(getMatcher).toHaveBeenCalledTimes(1)
  expect(matchers).toHaveLength(1)
  expect(matchers[0]).toHaveBeenCalledTimes(2)
  expect(engine.getPrecomputedQueryPlanCacheHit).toHaveBeenCalledTimes(1)
  expect(requestHandler.request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      precomputedQueryPlanCacheHit: expect.objectContaining({
        placeholderValues: { '%1': '2' },
      }),
    }),
  )
})

test('falls back to the slow path when runtime exact and lazy descriptors miss later args', async () => {
  const { registry, getMatcher, matchers } = createSpiedExactRegistry()
  const { engine, requestHandler, user } = createClient({
    descriptorMatcherRegistry: registry,
    precomputedHits: [
      { cacheKey: 'first-cache-key', placeholderValues: { '%1': '1' } },
      { cacheKey: 'second-cache-key', placeholderValues: { '%1': '2' } },
    ],
  })

  await user.findUnique({ where: { id: '1' }, select: { id: true, email: true, name: true } })
  await user.findUnique({ where: { id: '2' }, select: { id: true, email: true } })

  expect(getMatcher).toHaveBeenCalledTimes(2)
  expect(matchers[0]).toHaveBeenCalledTimes(2)
  expect(engine.getPrecomputedQueryPlanCacheHit).toHaveBeenCalledTimes(2)
  expect(requestHandler.request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      precomputedQueryPlanCacheHit: expect.objectContaining({
        cacheKey: 'second-cache-key',
        placeholderValues: { '%1': '2' },
      }),
    }),
  )
})

test('stores the runtime exact findMany matcher after slow-path parity self-test', async () => {
  const { registry, getMatcher, matchers } = createSpiedExactRegistry()
  const { engine, requestHandler, user } = createClient({
    descriptorMatcherRegistry: registry,
    placeholderValues: { '%1': 10 },
  })

  await user.findMany({ take: 10, select: { id: true, email: true, name: true } })
  await user.findMany({ take: 11, select: { id: true, email: true, name: true } })

  expect(getMatcher).toHaveBeenCalledTimes(1)
  expect(matchers).toHaveLength(1)
  expect(matchers[0]).toHaveBeenCalledTimes(2)
  expect(engine.getPrecomputedQueryPlanCacheHit).toHaveBeenCalledTimes(1)
  expect(requestHandler.request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      precomputedQueryPlanCacheHit: expect.objectContaining({
        placeholderValues: { '%1': 11 },
      }),
    }),
  )
})

function createSpiedExactRegistry() {
  const exactRegistry = createExactDescriptorMatcherRegistry([
    {
      model: 'User',
      action: 'findUnique',
      clientMethod: 'user.findUnique',
      field: 'id',
      valueType: 'string',
      select: ['id', 'email', 'name'],
    },
    {
      model: 'User',
      action: 'findMany',
      clientMethod: 'user.findMany',
      field: 'take',
      valueType: 'number',
      select: ['id', 'email', 'name'],
    },
  ])
  const matchers: jest.Mock[] = []
  const getMatcher = jest.fn((context: Parameters<DescriptorBoundMatcherRegistry['getMatcher']>[0]) => {
    const matcher = exactRegistry.getMatcher(context)
    if (matcher === undefined) {
      return undefined
    }

    const spiedMatcher = jest.fn(matcher)
    matchers.push(spiedMatcher)
    return spiedMatcher
  })

  return {
    registry: { getMatcher },
    getMatcher,
    matchers,
  } satisfies {
    registry: DescriptorBoundMatcherRegistry
    getMatcher: typeof getMatcher
    matchers: jest.Mock[]
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
