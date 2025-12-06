import type { SqlCommenterContext, SqlCommenterPlugin } from '@prisma/sqlcommenter'

import { appendSqlComment, applySqlCommenters, buildSqlComment, formatSqlComment } from './sql-commenter'

describe('formatSqlComment', () => {
  test('returns empty string for empty object', () => {
    expect(formatSqlComment({})).toBe('')
  })

  test('formats single key-value pair', () => {
    expect(formatSqlComment({ key: 'value' })).toBe("/*key='value'*/")
  })

  test('sorts keys lexicographically', () => {
    expect(formatSqlComment({ z: '1', a: '2', m: '3' })).toBe("/*a='2',m='3',z='1'*/")
  })

  test('URL-encodes keys', () => {
    expect(formatSqlComment({ 'key with spaces': 'value' })).toBe("/*key%20with%20spaces='value'*/")
  })

  test('URL-encodes values', () => {
    expect(formatSqlComment({ key: 'value with spaces' })).toBe("/*key='value%20with%20spaces'*/")
  })

  test('escapes single quotes in values after URL encoding', () => {
    // encodeURIComponent("it's") = "it's" (apostrophe is not encoded)
    // Then we replace ' with \'
    expect(formatSqlComment({ key: "it's" })).toBe("/*key='it\\'s'*/")
  })

  test('handles special characters', () => {
    // = is encoded to %3D, comma is encoded to %2C
    expect(formatSqlComment({ 'key=value': 'a,b' })).toBe("/*key%3Dvalue='a%2Cb'*/")
  })

  test('handles traceparent format', () => {
    const result = formatSqlComment({
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-b9c7c989f97918e1-01',
    })
    expect(result).toBe("/*traceparent='00-0af7651916cd43dd8448eb211c80319c-b9c7c989f97918e1-01'*/")
  })

  test('handles multiple realistic tags', () => {
    const result = formatSqlComment({
      traceparent: '00-abc-def-01',
      'prisma-query': 'eyJtb2RlbCI6IlVzZXIifQ==',
      application: 'my-app',
    })
    // Keys sorted: application, prisma-query, traceparent
    // == is encoded to %3D%3D
    expect(result).toBe(
      "/*application='my-app',prisma-query='eyJtb2RlbCI6IlVzZXIifQ%3D%3D',traceparent='00-abc-def-01'*/",
    )
  })

  test('handles empty string values', () => {
    expect(formatSqlComment({ key: '' })).toBe("/*key=''*/")
  })

  test('handles numeric-like string values', () => {
    expect(formatSqlComment({ version: '123' })).toBe("/*version='123'*/")
  })
})

describe('applySqlCommenters', () => {
  const mockSingleContext: SqlCommenterContext = {
    query: {
      type: 'single',
      modelName: 'User',
      action: 'findMany',
      query: { selection: { name: true } },
    },
  }

  const mockCompactedContext: SqlCommenterContext = {
    query: {
      type: 'compacted',
      modelName: 'User',
      action: 'findUnique',
      queries: [
        { arguments: { where: { id: 1 } }, selection: { $scalars: true } },
        { arguments: { where: { id: 2 } }, selection: { $scalars: true } },
      ],
    },
  }

  test('returns empty object with no plugins', () => {
    expect(applySqlCommenters([], mockSingleContext)).toEqual({})
  })

  test('calls plugin with context', () => {
    const plugin = jest.fn(() => ({ key: 'value' }))
    applySqlCommenters([plugin], mockSingleContext)
    expect(plugin).toHaveBeenCalledWith(mockSingleContext)
  })

  test('returns merged results from single plugin', () => {
    const plugin: SqlCommenterPlugin = () => ({ key: 'value' })
    expect(applySqlCommenters([plugin], mockSingleContext)).toEqual({ key: 'value' })
  })

  test('merges results from multiple plugins', () => {
    const plugin1: SqlCommenterPlugin = () => ({ a: '1' })
    const plugin2: SqlCommenterPlugin = () => ({ b: '2' })
    expect(applySqlCommenters([plugin1, plugin2], mockSingleContext)).toEqual({ a: '1', b: '2' })
  })

  test('later plugins override earlier ones for same key', () => {
    const plugin1: SqlCommenterPlugin = () => ({ key: 'first' })
    const plugin2: SqlCommenterPlugin = () => ({ key: 'second' })
    expect(applySqlCommenters([plugin1, plugin2], mockSingleContext)).toEqual({ key: 'second' })
  })

  test('handles plugin returning empty object', () => {
    const plugin: SqlCommenterPlugin = () => ({})
    expect(applySqlCommenters([plugin], mockSingleContext)).toEqual({})
  })

  test('filters out undefined values from plugin results', () => {
    const plugin: SqlCommenterPlugin = () => ({
      included: 'yes',
      excluded: undefined,
    })
    expect(applySqlCommenters([plugin], mockSingleContext)).toEqual({ included: 'yes' })
  })

  test('filters undefined values when merging multiple plugins', () => {
    const plugin1: SqlCommenterPlugin = () => ({ a: '1', b: undefined })
    const plugin2: SqlCommenterPlugin = () => ({ c: '3', d: undefined })
    expect(applySqlCommenters([plugin1, plugin2], mockSingleContext)).toEqual({ a: '1', c: '3' })
  })

  test("undefined value from later plugin doesn't remove key set by earlier plugin", () => {
    const plugin1: SqlCommenterPlugin = () => ({ key: 'value' })
    const plugin2: SqlCommenterPlugin = () => ({ key: undefined })
    expect(applySqlCommenters([plugin1, plugin2], mockSingleContext)).toEqual({ key: 'value' })
  })

  test('works with compacted query context', () => {
    const plugin: SqlCommenterPlugin = (ctx) => {
      const result: Record<string, string> = { batch: ctx.query.type === 'compacted' ? 'true' : 'false' }
      if (ctx.query.type === 'compacted') {
        result.count = String(ctx.query.queries.length)
      }
      return result
    }
    expect(applySqlCommenters([plugin], mockCompactedContext)).toEqual({ batch: 'true', count: '2' })
  })

  test('plugin can distinguish between single and compacted queries', () => {
    const plugin: SqlCommenterPlugin = (ctx) => {
      return { type: ctx.query.type }
    }
    expect(applySqlCommenters([plugin], mockSingleContext)).toEqual({ type: 'single' })
    expect(applySqlCommenters([plugin], mockCompactedContext)).toEqual({ type: 'compacted' })
  })

  test('context is frozen and cannot be mutated by plugins', () => {
    const mutatingPlugin: SqlCommenterPlugin = (ctx) => {
      expect(() => {
        Object.assign(ctx, { mutated: true })
      }).toThrow(TypeError)
      return { attempted: 'mutation' }
    }
    applySqlCommenters([mutatingPlugin], mockSingleContext)
  })

  test('nested context properties are frozen and cannot be mutated', () => {
    const mutatingPlugin: SqlCommenterPlugin = (ctx) => {
      expect(() => {
        Object.assign(ctx.query, { modelName: 'Hacked' })
      }).toThrow(TypeError)
      return { attempted: 'nested-mutation' }
    }
    applySqlCommenters([mutatingPlugin], mockSingleContext)
  })

  test('mutations from one plugin do not affect subsequent plugins', () => {
    let secondPluginSawModelName: string | undefined

    const firstPlugin: SqlCommenterPlugin = (ctx) => {
      try {
        Object.assign(ctx.query, { modelName: 'Hacked' })
      } catch {
        // Expected to throw
      }
      return { first: 'plugin' }
    }

    const secondPlugin: SqlCommenterPlugin = (ctx) => {
      secondPluginSawModelName = ctx.query.modelName
      return { second: 'plugin' }
    }

    applySqlCommenters([firstPlugin, secondPlugin], mockSingleContext)

    // Second plugin should see the original value
    expect(secondPluginSawModelName).toBe('User')
  })

  test('deeply nested objects in query are also frozen', () => {
    type NestedQuery = { selection: { name: boolean; nested: { deep: string } } }

    const contextWithNestedQuery: SqlCommenterContext = {
      query: {
        type: 'single',
        modelName: 'User',
        action: 'findMany',
        query: { selection: { name: true, nested: { deep: 'value' } } } satisfies NestedQuery,
      },
    }

    const mutatingPlugin: SqlCommenterPlugin = (ctx) => {
      if (ctx.query.type === 'single') {
        const query = ctx.query.query as NestedQuery
        expect(() => {
          query.selection.nested.deep = 'mutated'
        }).toThrow(TypeError)
      }
      return {}
    }

    applySqlCommenters([mutatingPlugin], contextWithNestedQuery)
  })

  test('arrays in context are frozen', () => {
    const mutatingPlugin: SqlCommenterPlugin = (ctx) => {
      const query = ctx.query
      if (query.type === 'compacted') {
        const mutableQueries = query.queries as unknown[]
        expect(() => {
          mutableQueries.push({ extra: 'query' })
        }).toThrow(TypeError)
        expect(() => {
          mutableQueries[0] = { replaced: true }
        }).toThrow(TypeError)
      }
      return {}
    }

    applySqlCommenters([mutatingPlugin], mockCompactedContext)
  })
})

describe('buildSqlComment', () => {
  const mockContext: SqlCommenterContext = {
    query: {
      type: 'single',
      modelName: 'User',
      action: 'findMany',
      query: {},
    },
  }

  test('returns empty string with no plugins', () => {
    expect(buildSqlComment([], mockContext)).toBe('')
  })

  test('formats result from plugins', () => {
    const plugin: SqlCommenterPlugin = () => ({ key: 'value' })
    expect(buildSqlComment([plugin], mockContext)).toBe("/*key='value'*/")
  })

  test('returns empty string when plugins return empty objects', () => {
    const plugin: SqlCommenterPlugin = () => ({})
    expect(buildSqlComment([plugin], mockContext)).toBe('')
  })
})

describe('appendSqlComment', () => {
  test('returns original SQL if comment is empty', () => {
    const sql = 'SELECT * FROM "User"'
    expect(appendSqlComment(sql, '')).toBe(sql)
  })

  test('appends comment with space separator', () => {
    const sql = 'SELECT * FROM "User"'
    const comment = "/*key='value'*/"
    expect(appendSqlComment(sql, comment)).toBe('SELECT * FROM "User" /*key=\'value\'*/')
  })

  test('works with complex SQL', () => {
    const sql = 'SELECT "id", "name" FROM "User" WHERE "active" = true ORDER BY "name"'
    const comment = "/*app='test'*/"
    expect(appendSqlComment(sql, comment)).toBe(
      'SELECT "id", "name" FROM "User" WHERE "active" = true ORDER BY "name" /*app=\'test\'*/',
    )
  })
})
