import { Decimal } from '@prisma/client-runtime-utils'

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
              id: { kind: 'placeholder', name: '%1', valueType: 'int32' },
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
  expect(matcher?.({ where: { id: 2.5 }, select: { id: true, email: true, name: true } })).toBeUndefined()
  expect(matcher?.({ where: { id: Number.NaN }, select: { id: true, email: true, name: true } })).toBeUndefined()
  expect(matcher?.({ where: { id: 2 ** 31 }, select: { id: true, email: true, name: true } })).toBeUndefined()
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

test('binds exact enum scalar matchers with mapped database values', () => {
  const matcher = bindMatcher({
    field: 'status',
    valueType: 'enum',
    enumValues: { ACTIVE: 'A', INACTIVE: 'I' },
    placeholderName: '%1',
    placeholderValue: 'A',
    descriptorValue: 'ACTIVE',
    select: ['id', 'status'],
  })

  expect(matcher?.({ where: { status: 'INACTIVE' }, select: { id: true, status: true } })).toEqual({
    '%1': 'I',
  })
  expect(matcher?.({ where: { status: 'UNKNOWN' }, select: { id: true, status: true } })).toBeUndefined()
  expect(
    matcher?.({ where: { status: { $type: 'Enum', value: 'ACTIVE' } }, select: { id: true, status: true } }),
  ).toBeUndefined()
})

test('binds exact boolean scalar matchers', () => {
  const matcher = bindMatcher({
    field: 'enabled',
    valueType: 'boolean',
    placeholderName: '%1',
    placeholderValue: true,
    select: ['id', 'enabled'],
  })

  expect(matcher?.({ where: { enabled: false }, select: { id: true, enabled: true } })).toEqual({
    '%1': false,
  })
  expect(matcher?.({ where: { enabled: 'false' }, select: { id: true, enabled: true } })).toBeUndefined()
})

test('binds exact float scalar matchers for finite non-integer args', () => {
  const matcher = bindMatcher({
    field: 'score',
    valueType: 'float',
    placeholderName: '%1',
    placeholderValue: 12.5,
    select: ['id', 'score'],
  })

  expect(matcher?.({ where: { score: 45.25 }, select: { id: true, score: true } })).toEqual({
    '%1': 45.25,
  })
  expect(matcher?.({ where: { score: 45 }, select: { id: true, score: true } })).toBeUndefined()
  expect(matcher?.({ where: { score: Number.NaN }, select: { id: true, score: true } })).toBeUndefined()
  expect(matcher?.({ where: { score: Number.POSITIVE_INFINITY }, select: { id: true, score: true } })).toBeUndefined()
})

test('binds exact bigint scalar matchers', () => {
  const matcher = bindMatcher({
    field: 'externalId',
    valueType: 'bigint',
    placeholderName: '%1',
    placeholderValue: '10',
    descriptorValue: 10n,
    select: ['id', 'externalId'],
  })

  expect(matcher?.({ where: { externalId: 11n }, select: { id: true, externalId: true } })).toEqual({
    '%1': '11',
  })
  expect(matcher?.({ where: { externalId: '11' }, select: { id: true, externalId: true } })).toBeUndefined()
})

test('binds exact datetime scalar matchers for Date args', () => {
  const matcher = bindMatcher({
    field: 'createdAt',
    valueType: 'date',
    placeholderName: '%1',
    placeholderValue: '2024-01-01T00:00:00.000Z',
    descriptorValue: new Date('2024-01-01T00:00:00.000Z'),
    select: ['id', 'createdAt'],
  })

  expect(
    matcher?.({
      where: { createdAt: new Date('2024-01-02T00:00:00.000Z') },
      select: { id: true, createdAt: true },
    }),
  ).toEqual({
    '%1': '2024-01-02T00:00:00.000Z',
  })
  expect(
    matcher?.({ where: { createdAt: '2024-01-02T00:00:00.000Z' }, select: { id: true, createdAt: true } }),
  ).toBeUndefined()
  expect(
    matcher?.({ where: { createdAt: new Date('invalid') }, select: { id: true, createdAt: true } }),
  ).toBeUndefined()
})

test('binds exact decimal scalar matchers for Decimal-like args', () => {
  const matcher = bindMatcher({
    field: 'balance',
    valueType: 'decimal',
    placeholderName: '%1',
    placeholderValue: '12.3',
    descriptorValue: new Decimal('12.30'),
    select: ['id', 'balance'],
  })

  expect(
    matcher?.({
      where: { balance: new Decimal('45.60') },
      select: { id: true, balance: true },
    }),
  ).toEqual({
    '%1': '45.6',
  })
  expect(matcher?.({ where: { balance: '45.60' }, select: { id: true, balance: true } })).toBeUndefined()
  expect(matcher?.({ where: { balance: 45.6 }, select: { id: true, balance: true } })).toBeUndefined()
})

test('binds exact bytes scalar matchers for Uint8Array args', () => {
  const matcher = bindMatcher({
    field: 'fingerprint',
    valueType: 'bytes',
    placeholderName: '%1',
    placeholderValue: 'AQID',
    descriptorValue: Uint8Array.from([1, 2, 3]),
    select: ['id', 'fingerprint'],
  })

  expect(
    matcher?.({
      where: { fingerprint: Uint8Array.from([4, 5]) },
      select: { id: true, fingerprint: true },
    }),
  ).toEqual({
    '%1': 'BAU=',
  })
  expect(matcher?.({ where: { fingerprint: 'BAU=' }, select: { id: true, fingerprint: true } })).toBeUndefined()
  expect(matcher?.({ where: { fingerprint: [4, 5] }, select: { id: true, fingerprint: true } })).toBeUndefined()
})

test('binds exact json scalar matchers for plain structural args', () => {
  const matcher = bindMatcher({
    field: 'metadata',
    valueType: 'json',
    placeholderName: '%1',
    placeholderValue: '{"tag":"initial","nested":[true,null,1]}',
    descriptorValue: { tag: 'initial', nested: [true, null, 1] },
    select: ['id', 'metadata'],
  })

  expect(
    matcher?.({
      where: { metadata: { tag: 'next', nested: [false, null, 2.5] } },
      select: { id: true, metadata: true },
    }),
  ).toEqual({
    '%1': '{"tag":"next","nested":[false,null,2.5]}',
  })
  expect(
    matcher?.({
      where: { metadata: ['next', { nested: true }] },
      select: { id: true, metadata: true },
    }),
  ).toEqual({
    '%1': '["next",{"nested":true}]',
  })
  expect(matcher?.({ where: { metadata: 'next' }, select: { id: true, metadata: true } })).toEqual({
    '%1': '"next"',
  })
  expect(matcher?.({ where: { metadata: 2.5 }, select: { id: true, metadata: true } })).toEqual({
    '%1': '2.5',
  })
  expect(matcher?.({ where: { metadata: true }, select: { id: true, metadata: true } })).toEqual({
    '%1': 'true',
  })
})

test('rejects json matcher args that need the normal serializer', () => {
  const matcher = bindMatcher({
    field: 'metadata',
    valueType: 'json',
    placeholderName: '%1',
    placeholderValue: '{"tag":"initial"}',
    descriptorValue: { tag: 'initial' },
    select: ['id', 'metadata'],
  })

  expect(matcher?.({ where: { metadata: null }, select: { id: true, metadata: true } })).toBeUndefined()
  expect(matcher?.({ where: { metadata: { tag: undefined } }, select: { id: true, metadata: true } })).toBeUndefined()
  expect(matcher?.({ where: { metadata: { tag: skip } }, select: { id: true, metadata: true } })).toBeUndefined()
  expect(
    matcher?.({ where: { metadata: { value: Number.NaN } }, select: { id: true, metadata: true } }),
  ).toBeUndefined()
  expect(
    matcher?.({
      where: { metadata: { $type: 'Json', value: '{"tag":"next"}' } },
      select: { id: true, metadata: true },
    }),
  ).toBeUndefined()
  expect(
    matcher?.({
      where: { metadata: { toJSON: () => ({ tag: 'next' }) } },
      select: { id: true, metadata: true },
    }),
  ).toBeUndefined()

  const inherited = Object.create({ inherited: true })
  inherited.tag = 'next'
  expect(matcher?.({ where: { metadata: inherited }, select: { id: true, metadata: true } })).toBeUndefined()
})

test('does not bind bigint scalar matchers when placeholder ownership is ambiguous', () => {
  const matcher = bindMatcher({
    field: 'externalId',
    valueType: 'bigint',
    placeholderName: '%1',
    placeholderValue: '10',
    descriptorValue: 10n,
    select: ['id', 'externalId'],
    extraPlaceholderValues: { '%2': '10' },
  })

  expect(matcher).toBeUndefined()
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
    takeDescriptor: { kind: 'placeholder', name: '%1', valueType: 'int32' },
    placeholderValues: { '%1': 10 },
  })

  expect(matcher?.({ take: 20, select: { id: true, email: true, name: true } })).toEqual({ '%1': 20 })
  expect(matcher?.({ take: '20', select: { id: true, email: true, name: true } })).toBeUndefined()
  expect(matcher?.({ take: 20.5, select: { id: true, email: true, name: true } })).toBeUndefined()
  expect(matcher?.({ take: Number.POSITIVE_INFINITY, select: { id: true, email: true, name: true } })).toBeUndefined()
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
  enumValues,
  placeholderName,
  placeholderValue,
  descriptorValue = placeholderValue,
  select,
  extraPlaceholderValues,
}: {
  field: string
  valueType: 'bigint' | 'boolean' | 'bytes' | 'date' | 'decimal' | 'enum' | 'float' | 'json' | 'number' | 'string'
  enumValues?: Record<string, string>
  placeholderName: string
  placeholderValue: unknown
  descriptorValue?: unknown
  select: string[]
  extraPlaceholderValues?: Record<string, unknown>
}) {
  const registry = createExactDescriptorMatcherRegistry([
    {
      model: 'User',
      action: 'findUnique',
      clientMethod: 'user.findUnique',
      field,
      valueType,
      enumValues,
      select,
    },
  ])

  return registry.getMatcher({
    model: 'User',
    action: 'findUnique',
    clientMethod: 'user.findUnique',
    args: {
      where: { [field]: descriptorValue },
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
              [field]:
                valueType === 'bigint'
                  ? { kind: 'constant', value: descriptorValue }
                  : valueType === 'bytes'
                    ? { kind: 'object', keys: [], fields: {} }
                    : valueType === 'date'
                      ? { kind: 'object', keys: [], fields: {} }
                      : valueType === 'decimal'
                        ? { kind: 'object', keys: [], fields: {} }
                        : valueType === 'json'
                          ? { kind: 'object', keys: [], fields: {} }
                          : valueType === 'enum'
                            ? { kind: 'constant', value: descriptorValue }
                            : { kind: 'placeholder', name: placeholderName, valueType: descriptorValueType(valueType) },
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
      placeholderValues: { [placeholderName]: placeholderValue, ...extraPlaceholderValues },
    },
  })
}

function bindFindManyMatcher({
  takeDescriptor,
  placeholderValues,
}: {
  takeDescriptor: { kind: 'placeholder'; name: string; valueType: 'int32' } | { kind: 'constant'; value: number }
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

function descriptorValueType(
  valueType: 'bigint' | 'boolean' | 'bytes' | 'date' | 'decimal' | 'float' | 'json' | 'number' | 'string',
) {
  return valueType === 'number' ? 'int32' : valueType
}
