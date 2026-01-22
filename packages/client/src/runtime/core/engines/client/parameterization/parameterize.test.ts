import type { RuntimeDataModel } from '@prisma/client-common'
import type { JsonQuery } from '@prisma/json-protocol'
import type { ParamGraph } from '@prisma/param-graph'
import { EdgeFlag, ScalarMask } from '@prisma/param-graph'

import { createParamGraphView } from './param-graph-view'
import { parameterizeBatch, parameterizeQuery } from './parameterize'

describe('parameterizeQuery', () => {
  // Sample ParamGraph simulating a User model with common fields
  const sampleGraph: ParamGraph = {
    s: [
      'where',
      'id',
      'email',
      'name',
      'equals',
      'contains',
      'in',
      'data',
      'selection',
      'posts',
      'title',
      'status',
      'create',
      'name_email',
    ],
    e: ['Status'],
    i: [
      // Node 0: UserWhereInput
      {
        f: {
          1: { k: EdgeFlag.ParamScalar | EdgeFlag.Object, m: ScalarMask.String, c: 1 }, // id
          2: { k: EdgeFlag.ParamScalar | EdgeFlag.Object, m: ScalarMask.String, c: 1 }, // email
          3: { k: EdgeFlag.ParamScalar, m: ScalarMask.String }, // name
          11: { k: EdgeFlag.ParamEnum, e: 0 }, // status (enum)
          13: { k: EdgeFlag.Object, c: 5 }, // name_email (compound unique)
        },
      },
      // Node 1: StringFilter
      {
        f: {
          4: { k: EdgeFlag.ParamScalar, m: ScalarMask.String }, // equals
          5: { k: EdgeFlag.ParamScalar, m: ScalarMask.String }, // contains
          6: { k: EdgeFlag.ParamListScalar, m: ScalarMask.String }, // in
        },
      },
      // Node 2: FindManyUserArgs
      {
        f: {
          0: { k: EdgeFlag.Object, c: 0 }, // where
        },
      },
      // Node 3: UserCreateInput
      {
        f: {
          1: { k: EdgeFlag.ParamScalar, m: ScalarMask.String }, // id
          2: { k: EdgeFlag.ParamScalar, m: ScalarMask.String }, // email
          3: { k: EdgeFlag.ParamScalar, m: ScalarMask.String }, // name
        },
      },
      // Node 4: CreateUserArgs
      {
        f: {
          7: { k: EdgeFlag.Object, c: 3 }, // data
        },
      },
      // Node 5: UserCompoundUniqueInput
      {
        f: {
          2: { k: EdgeFlag.ParamScalar, m: ScalarMask.String }, // email
          3: { k: EdgeFlag.ParamScalar, m: ScalarMask.String }, // name
        },
      },
      // Node 6: UpsertUserArgs
      {
        f: {
          0: { k: EdgeFlag.Object, c: 0 }, // where
          12: { k: EdgeFlag.Object, c: 3 }, // create
        },
      },
    ],
    o: [
      // Node 0: UserOutput
      {
        f: {
          9: { a: 5, o: 1 }, // posts
        },
      },
      // Node 1: PostOutput
      {},
    ],
    r: {
      'User.findMany': { a: 2, o: 0 },
      'User.findUnique': { a: 2, o: 0 },
      'User.createOne': { a: 4, o: 0 },
      'User.upsertOne': { a: 6, o: 0 },
    },
  }

  const sampleRuntimeDataModel: RuntimeDataModel = {
    models: {},
    enums: {
      Status: {
        values: [
          { name: 'ACTIVE', dbName: null },
          { name: 'INACTIVE', dbName: null },
        ],
        dbName: null,
      },
    },
    types: {},
  }

  const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)

  describe('basic parameterization', () => {
    it('parameterizes scalar values in where clause', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { name: 'John' } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({
        'query.arguments.where.name': 'John',
      })
      expect(result.parameterizedQuery.query.arguments).toEqual({
        where: { name: { $type: 'Param', value: { name: 'query.arguments.where.name', type: 'String' } } },
      })
    })

    it('parameterizes multiple fields', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { id: '123', email: 'test@example.com' } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({
        'query.arguments.where.email': 'test@example.com',
        'query.arguments.where.id': '123',
      })
      expect(Object.keys(result.placeholderValues).length).toBe(2)
    })
  })

  describe('filter operators', () => {
    it('parameterizes equals filter', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { id: { equals: 'abc' } } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({
        'query.arguments.where.id.equals': 'abc',
      })
    })

    it('parameterizes contains filter', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { email: { contains: 'example' } } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({
        'query.arguments.where.email.contains': 'example',
      })
    })

    it('parameterizes in filter as whole list', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { id: { in: ['a', 'b', 'c'] } } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({
        'query.arguments.where.id.in': ['a', 'b', 'c'],
      })
    })
  })

  describe('null handling', () => {
    it('preserves null values (never parameterizes)', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { name: null } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({})
      expect(result.parameterizedQuery.query.arguments).toEqual({
        where: { name: null },
      })
    })
  })

  describe('structural values', () => {
    it('preserves FieldRef values', () => {
      const fieldRef = { $type: 'FieldRef' as const, value: { _ref: 'balance', _container: 'User' } }
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { id: { equals: fieldRef } } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({})
      expect(result.parameterizedQuery.query.arguments).toEqual({
        where: { id: { equals: fieldRef } },
      })
    })

    it('preserves Enum tagged values', () => {
      const enumValue = { $type: 'Enum' as const, value: 'ACTIVE' }
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { status: enumValue } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({})
      expect(result.parameterizedQuery.query.arguments).toEqual({
        where: { status: enumValue },
      })
    })
  })

  describe('tagged scalar values', () => {
    it('parameterizes DateTime tagged values', () => {
      // Create a graph that includes DateTime support
      const graphWithDateTime: ParamGraph = {
        ...sampleGraph,
        i: [
          ...sampleGraph.i,
          {
            f: {
              0: { k: EdgeFlag.ParamScalar, m: ScalarMask.DateTime }, // createdAt
            },
          },
        ],
        r: {
          ...sampleGraph.r,
          'User.findByDate': { a: 7 },
        },
      }

      const viewWithDateTime = createParamGraphView(graphWithDateTime, sampleRuntimeDataModel)
      const dateValue = { $type: 'DateTime' as const, value: '2024-01-01T00:00:00.000Z' }

      const query: JsonQuery = {
        modelName: 'User',
        action: 'findByDate' as any,
        query: {
          arguments: { where: dateValue },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, viewWithDateTime)

      // DateTime should be parameterized with decoded value
      expect(result.placeholderValues['query.arguments.where']).toBe('2024-01-01T00:00:00.000Z')
    })
  })

  describe('enum membership validation', () => {
    it('parameterizes valid enum values', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { status: 'ACTIVE' } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({
        'query.arguments.where.status': 'ACTIVE',
      })
    })

    it('does not parameterize invalid enum values', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { status: 'INVALID_STATUS' } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({})
      expect(result.parameterizedQuery.query.arguments).toEqual({
        where: { status: 'INVALID_STATUS' },
      })
    })
  })

  describe('selection preservation', () => {
    it('preserves $scalars marker', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { id: '123' } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.parameterizedQuery.query.selection).toEqual({ $scalars: true })
    })

    it('preserves $composites marker', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { id: '123' } },
          selection: { $scalars: true, $composites: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.parameterizedQuery.query.selection).toEqual({ $scalars: true, $composites: true })
    })

    it('preserves boolean field selections', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { id: '123' } },
          selection: { id: true, email: true, name: false },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.parameterizedQuery.query.selection).toEqual({
        id: true,
        email: true,
        name: false,
      })
    })
  })

  describe('unknown fields', () => {
    it('preserves unknown fields without parameterization', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { unknownField: 'value' } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      // Unknown field should be preserved as-is
      expect(result.parameterizedQuery.query.arguments).toEqual({
        where: { unknownField: 'value' },
      })
      expect(result.placeholderValues).toEqual({})
    })
  })

  describe('create operations', () => {
    it('parameterizes data in create operations', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'createOne',
        query: {
          arguments: { data: { id: '123', email: 'test@example.com', name: 'John' } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({
        'query.arguments.data.email': 'test@example.com',
        'query.arguments.data.id': '123',
        'query.arguments.data.name': 'John',
      })
    })
  })

  describe('upsert operations', () => {
    it('reuses placeholders for matching unique values in where and create', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'upsertOne',
        query: {
          arguments: {
            where: { email: 'test@example.com' },
            create: { email: 'test@example.com', name: 'Alice' },
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({
        'query.arguments.create.name': 'Alice',
        'query.arguments.where.email': 'test@example.com',
      })
      expect(result.parameterizedQuery.query.arguments).toEqual({
        where: { email: { $type: 'Param', value: { name: 'query.arguments.where.email', type: 'String' } } },
        create: {
          email: { $type: 'Param', value: { name: 'query.arguments.where.email', type: 'String' } },
          name: { $type: 'Param', value: { name: 'query.arguments.create.name', type: 'String' } },
        },
      })
    })

    it('reuses placeholders for compound unique values', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'upsertOne',
        query: {
          arguments: {
            where: { name_email: { name: 'Alice', email: 'alice@example.com' } },
            create: { name: 'Alice', email: 'alice@example.com' },
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({
        'query.arguments.where.name_email.email': 'alice@example.com',
        'query.arguments.where.name_email.name': 'Alice',
      })
      expect(result.parameterizedQuery.query.arguments).toEqual({
        where: {
          name_email: {
            name: { $type: 'Param', value: { name: 'query.arguments.where.name_email.name', type: 'String' } },
            email: { $type: 'Param', value: { name: 'query.arguments.where.name_email.email', type: 'String' } },
          },
        },
        create: {
          name: { $type: 'Param', value: { name: 'query.arguments.where.name_email.name', type: 'String' } },
          email: { $type: 'Param', value: { name: 'query.arguments.where.name_email.email', type: 'String' } },
        },
      })
    })

    it('keeps distinct placeholders when values differ', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'upsertOne',
        query: {
          arguments: {
            where: { email: 'alice@example.com' },
            create: { email: 'bob@example.com' },
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      expect(result.placeholderValues).toEqual({
        'query.arguments.create.email': 'bob@example.com',
        'query.arguments.where.email': 'alice@example.com',
      })
      expect(result.parameterizedQuery.query.arguments).toEqual({
        where: { email: { $type: 'Param', value: { name: 'query.arguments.where.email', type: 'String' } } },
        create: { email: { $type: 'Param', value: { name: 'query.arguments.create.email', type: 'String' } } },
      })
    })
  })

  describe('cache key consistency', () => {
    it('generates same parameterized query for different values with same structure', () => {
      const query1: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { id: '123' } },
          selection: { $scalars: true },
        },
      }

      const query2: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { id: '456' } },
          selection: { $scalars: true },
        },
      }

      const result1 = parameterizeQuery(query1, view)
      const result2 = parameterizeQuery(query2, view)

      const cacheKey1 = JSON.stringify(result1.parameterizedQuery)
      const cacheKey2 = JSON.stringify(result2.parameterizedQuery)

      expect(cacheKey1).toBe(cacheKey2)
    })

    it('generates different parameterized query for different structures', () => {
      const query1: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { id: '123' } },
          selection: { $scalars: true },
        },
      }

      const query2: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { email: 'test@example.com' } },
          selection: { $scalars: true },
        },
      }

      const result1 = parameterizeQuery(query1, view)
      const result2 = parameterizeQuery(query2, view)

      const cacheKey1 = JSON.stringify(result1.parameterizedQuery)
      const cacheKey2 = JSON.stringify(result2.parameterizedQuery)

      expect(cacheKey1).not.toBe(cacheKey2)
    })
  })

  describe('unknown root operations', () => {
    it('returns query unchanged when root is not found', () => {
      const query: JsonQuery = {
        modelName: 'UnknownModel',
        action: 'findMany',
        query: {
          arguments: { where: { id: '123' } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query, view)

      // Query should be unchanged (no parameterization possible)
      expect(result.parameterizedQuery.query.arguments).toEqual({
        where: { id: '123' },
      })
      expect(result.placeholderValues).toEqual({})
    })
  })
})

describe('parameterizeBatch', () => {
  const sampleGraph: ParamGraph = {
    s: ['where', 'id', 'email'],
    e: [],
    i: [
      // Node 0: UserWhereInput
      {
        f: {
          1: { k: EdgeFlag.ParamScalar, m: ScalarMask.String }, // id
          2: { k: EdgeFlag.ParamScalar, m: ScalarMask.String }, // email
        },
      },
      // Node 1: FindUserArgs
      {
        f: {
          0: { k: EdgeFlag.Object, c: 0 }, // where
        },
      },
    ],
    o: [],
    r: {
      'User.findUnique': { a: 1 },
      'User.findMany': { a: 1 },
    },
  }

  const sampleRuntimeDataModel: RuntimeDataModel = {
    models: {},
    enums: {},
    types: {},
  }

  const view = createParamGraphView(sampleGraph, sampleRuntimeDataModel)

  it('parameterizes all queries in a batch with unique placeholder names', () => {
    const batch = {
      batch: [
        {
          modelName: 'User',
          action: 'findUnique' as const,
          query: {
            arguments: { where: { id: '123' } },
            selection: { $scalars: true },
          },
        },
        {
          modelName: 'User',
          action: 'findUnique' as const,
          query: {
            arguments: { where: { id: '456' } },
            selection: { $scalars: true },
          },
        },
      ],
    }

    const result = parameterizeBatch(batch, view)

    expect(result.placeholderValues).toEqual({
      'batch[0].query.arguments.where.id': '123',
      'batch[1].query.arguments.where.id': '456',
    })
  })

  it('preserves transaction info', () => {
    const batch = {
      batch: [
        {
          modelName: 'User',
          action: 'findUnique' as const,
          query: {
            arguments: { where: { id: '123' } },
            selection: { $scalars: true },
          },
        },
      ],
      transaction: { isolationLevel: 'Serializable' as const },
    }

    const result = parameterizeBatch(batch, view)

    expect(result.parameterizedBatch.transaction).toEqual({ isolationLevel: 'Serializable' })
  })

  it('generates consistent cache keys for batches with same structure', () => {
    const batch1 = {
      batch: [
        {
          modelName: 'User',
          action: 'findUnique' as const,
          query: {
            arguments: { where: { id: '123' } },
            selection: { $scalars: true },
          },
        },
        {
          modelName: 'User',
          action: 'findUnique' as const,
          query: {
            arguments: { where: { id: '456' } },
            selection: { $scalars: true },
          },
        },
      ],
    }

    const batch2 = {
      batch: [
        {
          modelName: 'User',
          action: 'findUnique' as const,
          query: {
            arguments: { where: { id: 'abc' } },
            selection: { $scalars: true },
          },
        },
        {
          modelName: 'User',
          action: 'findUnique' as const,
          query: {
            arguments: { where: { id: 'def' } },
            selection: { $scalars: true },
          },
        },
      ],
    }

    const result1 = parameterizeBatch(batch1, view)
    const result2 = parameterizeBatch(batch2, view)

    const cacheKey1 = JSON.stringify(result1.parameterizedBatch)
    const cacheKey2 = JSON.stringify(result2.parameterizedBatch)

    expect(cacheKey1).toBe(cacheKey2)
  })

  it('generates different cache keys for batches with different structures', () => {
    const batch1 = {
      batch: [
        {
          modelName: 'User',
          action: 'findUnique' as const,
          query: {
            arguments: { where: { id: '123' } },
            selection: { $scalars: true },
          },
        },
      ],
    }

    const batch2 = {
      batch: [
        {
          modelName: 'User',
          action: 'findUnique' as const,
          query: {
            arguments: { where: { email: 'test@example.com' } },
            selection: { $scalars: true },
          },
        },
      ],
    }

    const result1 = parameterizeBatch(batch1, view)
    const result2 = parameterizeBatch(batch2, view)

    const cacheKey1 = JSON.stringify(result1.parameterizedBatch)
    const cacheKey2 = JSON.stringify(result2.parameterizedBatch)

    expect(cacheKey1).not.toBe(cacheKey2)
  })

  it('handles empty batch', () => {
    const batch = { batch: [] }

    const result = parameterizeBatch(batch, view)

    expect(result.parameterizedBatch.batch).toEqual([])
    expect(result.placeholderValues).toEqual({})
  })
})
