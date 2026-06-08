import type { DescriptorBoundMatcherRegistry } from '@prisma/client-common'

import { field, model, runtimeDataModel } from '../../../testUtils/dataModelBuilder'
import type { Client } from '../../getPrismaClient'
import { MergedExtensionsList } from '../extensions/MergedExtensionsList'
import { applyModel } from './applyModel'

const datamodel = runtimeDataModel({
  models: [model('User', [field('scalar', 'name', 'String')])],
})

function createClient({
  descriptorMatcherRegistry,
  placeholderValues = { '%1': '1' },
}: {
  descriptorMatcherRegistry?: DescriptorBoundMatcherRegistry
  placeholderValues?: Record<string, unknown>
} = {}) {
  const engine = {
    getPrecomputedQueryPlanCacheHit: jest.fn(() => ({
      cacheKey: 'cache-key',
      placeholderValues,
    })),
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
  const registry: DescriptorBoundMatcherRegistry = {
    getMatcher: jest.fn(() => matcher),
  }
  const { engine, requestHandler, user } = createClient({ descriptorMatcherRegistry: registry })

  await user.findUnique({ where: { id: '1' }, select: { id: true } })
  await user.findUnique({ where: { id: '2' }, select: { id: true } })

  expect(registry.getMatcher).toHaveBeenCalledTimes(1)
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
  const registry: DescriptorBoundMatcherRegistry = {
    getMatcher: jest.fn(() => matcher),
  }
  const { engine, requestHandler, user } = createClient({
    descriptorMatcherRegistry: registry,
    placeholderValues: { '%1': '1', '%2': 'Alice' },
  })

  await user.findUnique({ where: { id: '1', name: 'Alice' }, select: { id: true } })
  await user.findUnique({ where: { id: '2', name: 'Bob' }, select: { id: true } })

  expect(registry.getMatcher).toHaveBeenCalledTimes(1)
  expect(matcher).toHaveBeenCalledTimes(1)
  expect(engine.getPrecomputedQueryPlanCacheHit).toHaveBeenCalledTimes(1)

  const secondHit = requestHandler.request.mock.calls[1][0].precomputedQueryPlanCacheHit
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
  const registry: DescriptorBoundMatcherRegistry = {
    getMatcher: jest.fn(() => matcher),
  }
  const { engine, requestHandler, user } = createClient({ descriptorMatcherRegistry: registry })

  await user.findUnique({ where: { id: '1' }, select: { id: true } })
  await user.findUnique({ where: { id: '2' }, select: { id: true } })

  expect(registry.getMatcher).toHaveBeenCalledTimes(1)
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
