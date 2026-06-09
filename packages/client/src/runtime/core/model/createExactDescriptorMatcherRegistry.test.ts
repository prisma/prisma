import { skip } from '../types'
import { createExactDescriptorMatcherRegistry } from './createExactDescriptorMatcherRegistry'

test('binds an exact findUnique scalar matcher to a learned descriptor', () => {
  const registry = createExactDescriptorMatcherRegistry([
    {
      model: 'User',
      action: 'findUnique',
      clientMethod: 'user.findUnique',
      field: 'id',
      valueType: 'number',
      select: ['id', 'email', 'name'],
    },
  ])

  const matcher = registry.getMatcher({
    model: 'User',
    action: 'findUnique',
    clientMethod: 'user.findUnique',
    args: { where: { id: 1 }, select: { id: true, email: true, name: true } },
    protocolQuery: {},
    descriptor: {
      root: {
        kind: 'object',
        keys: ['where', 'select'],
        fields: {
          where: {
            kind: 'object',
            keys: ['id'],
            fields: {
              id: { kind: 'placeholder', name: '%1', valueType: 'number' },
            },
          },
          select: {
            kind: 'object',
            keys: ['id', 'email', 'name'],
            fields: {
              id: { kind: 'constant', value: true },
              email: { kind: 'constant', value: true },
              name: { kind: 'constant', value: true },
            },
          },
        },
      },
    },
    precomputedQueryPlanCacheHit: {
      cacheKey: 'cache-key',
      placeholderValues: { '%1': 1 },
    },
  })

  expect(matcher?.({ where: { id: 2 }, select: { id: true, email: true, name: true } })).toEqual({ '%1': 2 })
  expect(matcher?.({ select: { id: true, email: true, name: true }, where: { id: 2 } })).toBeUndefined()
  expect(matcher?.({ where: { id: '2' }, select: { id: true, email: true, name: true } })).toBeUndefined()
  expect(matcher?.({ where: { id: 2 }, select: { id: true, email: true, name: true, extra: true } })).toBeUndefined()
})

test('does not bind when the learned descriptor does not match the spec', () => {
  const registry = createExactDescriptorMatcherRegistry([
    {
      model: 'User',
      action: 'findUnique',
      clientMethod: 'user.findUnique',
      field: 'id',
      valueType: 'number',
      select: ['id', 'email', 'name'],
    },
  ])

  expect(
    registry.getMatcher({
      model: 'User',
      action: 'findUnique',
      clientMethod: 'user.findUnique',
      args: {},
      protocolQuery: {},
      descriptor: {
        root: {
          kind: 'object',
          keys: ['where', 'select'],
          fields: {
            where: {
              kind: 'object',
              keys: ['id'],
              fields: {
                id: { kind: 'placeholder', name: '%1', valueType: 'string' },
              },
            },
            select: {
              kind: 'object',
              keys: ['id', 'email', 'name'],
              fields: {
                id: { kind: 'constant', value: true },
                email: { kind: 'constant', value: true },
                name: { kind: 'constant', value: true },
              },
            },
          },
        },
      },
      precomputedQueryPlanCacheHit: {
        cacheKey: 'cache-key',
        placeholderValues: { '%1': 1 },
      },
    }),
  ).toBeUndefined()
})

test('binds exact string scalar matchers', () => {
  const matcher = bindMatcher({
    field: 'email',
    valueType: 'string',
    placeholderName: '%2',
    placeholderValue: 'alice@example.test',
    select: ['id', 'email'],
  })

  expect(matcher?.({ where: { email: 'bob@example.test' }, select: { id: true, email: true } })).toEqual({
    '%2': 'bob@example.test',
  })
  expect(matcher?.({ where: { email: 2 }, select: { id: true, email: true } })).toBeUndefined()
})

test('rejects generated args that would change the exact query shape', () => {
  const matcher = bindMatcher({
    field: 'id',
    valueType: 'number',
    placeholderName: '%1',
    placeholderValue: 1,
    select: ['id', 'email', 'name'],
  })

  expect(
    matcher?.({
      where: { id: 2 },
      select: { id: true, email: true, name: true },
      extra: undefined,
    }),
  ).toBeUndefined()
  expect(
    matcher?.({
      where: { id: 2, extra: undefined },
      select: { id: true, email: true, name: true },
    }),
  ).toBeUndefined()
  expect(
    matcher?.({
      where: { id: 2 },
      select: { id: true, email: skip, name: true },
    }),
  ).toBeUndefined()
  expect(
    matcher?.({
      where: { id: 2 },
      select: { id: true, email: true, name: true },
      omit: skip,
    }),
  ).toBeUndefined()
})

test('binds exact findMany take matchers', () => {
  const matcher = bindFindManyMatcher({
    takeDescriptor: { kind: 'placeholder', name: '%1', valueType: 'number' },
    placeholderValues: { '%1': 10 },
  })

  expect(matcher?.({ take: 20, select: { id: true, email: true, name: true } })).toEqual({ '%1': 20 })
  expect(matcher?.({ take: '20', select: { id: true, email: true, name: true } })).toBeUndefined()
  expect(matcher?.({ select: { id: true, email: true, name: true }, take: 20 })).toBeUndefined()
  expect(matcher?.({ take: 20, select: { id: true, email: true } })).toBeUndefined()
})

test('binds exact findMany constant take matchers without placeholders', () => {
  const matcher = bindFindManyMatcher({
    takeDescriptor: { kind: 'constant', value: 10 },
    placeholderValues: {},
  })

  expect(matcher?.({ take: 10, select: { id: true, email: true, name: true } })).toEqual({})
  expect(matcher?.({ take: 11, select: { id: true, email: true, name: true } })).toBeUndefined()
})

function bindMatcher({
  field,
  valueType,
  placeholderName,
  placeholderValue,
  select,
}: {
  field: string
  valueType: 'number' | 'string'
  placeholderName: string
  placeholderValue: unknown
  select: string[]
}) {
  const registry = createExactDescriptorMatcherRegistry([
    {
      model: 'User',
      action: 'findUnique',
      clientMethod: 'user.findUnique',
      field,
      valueType,
      select,
    },
  ])

  return registry.getMatcher({
    model: 'User',
    action: 'findUnique',
    clientMethod: 'user.findUnique',
    args: {
      where: { [field]: placeholderValue },
      select: Object.fromEntries(select.map((fieldName) => [fieldName, true])),
    },
    protocolQuery: {},
    descriptor: {
      root: {
        kind: 'object',
        keys: ['where', 'select'],
        fields: {
          where: {
            kind: 'object',
            keys: [field],
            fields: {
              [field]: { kind: 'placeholder', name: placeholderName, valueType },
            },
          },
          select: {
            kind: 'object',
            keys: select,
            fields: Object.fromEntries(select.map((fieldName) => [fieldName, { kind: 'constant', value: true }])),
          },
        },
      },
    },
    precomputedQueryPlanCacheHit: {
      cacheKey: 'cache-key',
      placeholderValues: { [placeholderName]: placeholderValue },
    },
  })
}

function bindFindManyMatcher({
  takeDescriptor,
  placeholderValues,
}: {
  takeDescriptor: { kind: 'placeholder'; name: string; valueType: 'number' } | { kind: 'constant'; value: number }
  placeholderValues: Record<string, unknown>
}) {
  const registry = createExactDescriptorMatcherRegistry([
    {
      model: 'User',
      action: 'findMany',
      clientMethod: 'user.findMany',
      field: 'take',
      valueType: 'number',
      select: ['id', 'email', 'name'],
    },
  ])

  return registry.getMatcher({
    model: 'User',
    action: 'findMany',
    clientMethod: 'user.findMany',
    args: {
      take: 10,
      select: { id: true, email: true, name: true },
    },
    protocolQuery: {},
    descriptor: {
      root: {
        kind: 'object',
        keys: ['take', 'select'],
        fields: {
          take: takeDescriptor,
          select: {
            kind: 'object',
            keys: ['id', 'email', 'name'],
            fields: {
              id: { kind: 'constant', value: true },
              email: { kind: 'constant', value: true },
              name: { kind: 'constant', value: true },
            },
          },
        },
      },
    },
    precomputedQueryPlanCacheHit: {
      cacheKey: 'cache-key',
      placeholderValues,
    },
  })
}
