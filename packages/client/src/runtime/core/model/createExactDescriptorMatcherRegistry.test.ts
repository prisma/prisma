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
