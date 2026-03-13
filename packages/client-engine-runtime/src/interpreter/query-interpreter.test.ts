import { describe, expect, test } from 'vitest'

import { MockDriverAdapter, mockTracingHelper } from '../../bench/mock-adapter'
import type { FieldOperation, QueryPlanNode } from '../query-plan'
import { QueryInterpreter, QueryInterpreterOptions } from './query-interpreter'
import { serializeSql } from './serialize-sql'

function createInterpreterOptions(): QueryInterpreterOptions {
  return {
    tracingHelper: mockTracingHelper,
    serializer: serializeSql,
    provider: 'postgres',
    connectionInfo: { supportsRelationJoins: false },
  }
}

function createRuntimeOptions(adapter: MockDriverAdapter) {
  return {
    queryable: adapter,
    scope: {},
    transactionManager: { enabled: false },
  } as const
}

/**
 * Constructs a query plan that SELECTs a record and then applies a mapRecord
 * field operation, simulating an update with increment/decrement.
 */
function makeMapRecordPlan(
  selectSql: string,
  fields: Record<string, { type: 'add' | 'subtract' | 'multiply' | 'divide'; value: unknown }>,
): QueryPlanNode {
  return {
    type: 'mapRecord',
    args: {
      expr: {
        type: 'unique',
        args: {
          type: 'query',
          args: {
            type: 'templateSql',
            fragments: [{ type: 'stringChunk', chunk: selectSql }],
            placeholderFormat: { prefix: '$', hasNumbering: true },
            args: [],
            argTypes: [],
            chunkable: false,
          },
        },
      },
      fields: fields as Record<string, FieldOperation>,
    },
  }
}

describe('mapRecord field operations', () => {
  describe('decimal precision', () => {
    test('add preserves precision for large decimal strings', async () => {
      const adapter = new MockDriverAdapter()
      adapter.setQueryResult('SELECT', {
        columnNames: ['id', 'amount'],
        columnTypes: [0, 1],
        rows: [[1, '5000000000000000000000000000']],
      })

      const plan = makeMapRecordPlan('SELECT id, amount FROM Account WHERE id = 1', {
        amount: { type: 'add', value: '1000000000000000000000' },
      })

      const interpreter = QueryInterpreter.forSql(createInterpreterOptions())
      const result = await interpreter.run(plan, createRuntimeOptions(adapter))

      expect((result as Record<string, unknown>).amount).toBe('5000001000000000000000000000')
    })

    test('subtract preserves precision for large decimal strings', async () => {
      const adapter = new MockDriverAdapter()
      adapter.setQueryResult('SELECT', {
        columnNames: ['id', 'amount'],
        columnTypes: [0, 1],
        rows: [[1, '5000000000000000000000000000']],
      })

      const plan = makeMapRecordPlan('SELECT id, amount FROM Account WHERE id = 1', {
        amount: { type: 'subtract', value: '1000000000000000000000' },
      })

      const interpreter = QueryInterpreter.forSql(createInterpreterOptions())
      const result = await interpreter.run(plan, createRuntimeOptions(adapter))

      expect((result as Record<string, unknown>).amount).toBe('4999999000000000000000000000')
    })

    test('multiply preserves precision for large decimal strings', async () => {
      const adapter = new MockDriverAdapter()
      adapter.setQueryResult('SELECT', {
        columnNames: ['id', 'amount'],
        columnTypes: [0, 1],
        rows: [[1, '1000000000000000000']],
      })

      const plan = makeMapRecordPlan('SELECT id, amount FROM Account WHERE id = 1', {
        amount: { type: 'multiply', value: '1000000000' },
      })

      const interpreter = QueryInterpreter.forSql(createInterpreterOptions())
      const result = await interpreter.run(plan, createRuntimeOptions(adapter))

      expect((result as Record<string, unknown>).amount).toBe('1000000000000000000000000000')
    })

    test('divide preserves precision for large decimal strings', async () => {
      const adapter = new MockDriverAdapter()
      adapter.setQueryResult('SELECT', {
        columnNames: ['id', 'amount'],
        columnTypes: [0, 1],
        rows: [[1, '1000000000000000000000000000']],
      })

      const plan = makeMapRecordPlan('SELECT id, amount FROM Account WHERE id = 1', {
        amount: { type: 'divide', value: '1000000000' },
      })

      const interpreter = QueryInterpreter.forSql(createInterpreterOptions())
      const result = await interpreter.run(plan, createRuntimeOptions(adapter))

      expect((result as Record<string, unknown>).amount).toBe('1000000000000000000')
    })

    test('divide by zero returns null for decimal strings', async () => {
      const adapter = new MockDriverAdapter()
      adapter.setQueryResult('SELECT', {
        columnNames: ['id', 'amount'],
        columnTypes: [0, 1],
        rows: [[1, '1000000000000000000000000000']],
      })

      const plan = makeMapRecordPlan('SELECT id, amount FROM Account WHERE id = 1', {
        amount: { type: 'divide', value: '0' },
      })

      const interpreter = QueryInterpreter.forSql(createInterpreterOptions())
      const result = await interpreter.run(plan, createRuntimeOptions(adapter))

      expect((result as Record<string, unknown>).amount).toBeNull()
    })

    test('add preserves precision beyond 20 significant digits', async () => {
      const adapter = new MockDriverAdapter()
      adapter.setQueryResult('SELECT', {
        columnNames: ['id', 'amount'],
        columnTypes: [0, 1],
        rows: [[1, '1234567890123456789012345678']],
      })

      const plan = makeMapRecordPlan('SELECT id, amount FROM Account WHERE id = 1', {
        amount: { type: 'add', value: '1' },
      })

      const interpreter = QueryInterpreter.forSql(createInterpreterOptions())
      const result = await interpreter.run(plan, createRuntimeOptions(adapter))

      expect((result as Record<string, unknown>).amount).toBe('1234567890123456789012345679')
    })

    test('add with string value and number operand uses Decimal', async () => {
      const adapter = new MockDriverAdapter()
      adapter.setQueryResult('SELECT', {
        columnNames: ['id', 'amount'],
        columnTypes: [0, 1],
        rows: [[1, '99999999999999999']],
      })

      const plan = makeMapRecordPlan('SELECT id, amount FROM Account WHERE id = 1', {
        amount: { type: 'add', value: 1 },
      })

      const interpreter = QueryInterpreter.forSql(createInterpreterOptions())
      const result = await interpreter.run(plan, createRuntimeOptions(adapter))

      expect((result as Record<string, unknown>).amount).toBe('100000000000000000')
    })
  })

  describe('regular number arithmetic', () => {
    test('add works correctly for regular numbers', async () => {
      const adapter = new MockDriverAdapter()
      adapter.setQueryResult('SELECT', {
        columnNames: ['id', 'count'],
        columnTypes: [0, 0],
        rows: [[1, 10]],
      })

      const plan = makeMapRecordPlan('SELECT id, count FROM Counter WHERE id = 1', {
        count: { type: 'add', value: 5 },
      })

      const interpreter = QueryInterpreter.forSql(createInterpreterOptions())
      const result = await interpreter.run(plan, createRuntimeOptions(adapter))

      expect((result as Record<string, unknown>).count).toBe(15)
    })

    test('divide by zero returns null for regular numbers', async () => {
      const adapter = new MockDriverAdapter()
      adapter.setQueryResult('SELECT', {
        columnNames: ['id', 'count'],
        columnTypes: [0, 0],
        rows: [[1, 10]],
      })

      const plan = makeMapRecordPlan('SELECT id, count FROM Counter WHERE id = 1', {
        count: { type: 'divide', value: 0 },
      })

      const interpreter = QueryInterpreter.forSql(createInterpreterOptions())
      const result = await interpreter.run(plan, createRuntimeOptions(adapter))

      expect((result as Record<string, unknown>).count).toBeNull()
    })

    test('number value with string operand uses Decimal path', async () => {
      const adapter = new MockDriverAdapter()
      adapter.setQueryResult('SELECT', {
        columnNames: ['id', 'count'],
        columnTypes: [0, 0],
        rows: [[1, 10]],
      })

      const plan = makeMapRecordPlan('SELECT id, count FROM Counter WHERE id = 1', {
        count: { type: 'add', value: '5' },
      })

      const interpreter = QueryInterpreter.forSql(createInterpreterOptions())
      const result = await interpreter.run(plan, createRuntimeOptions(adapter))

      expect((result as Record<string, unknown>).count).toBe('15')
    })

    test('float arithmetic still works', async () => {
      const adapter = new MockDriverAdapter()
      adapter.setQueryResult('SELECT', {
        columnNames: ['id', 'credit'],
        columnTypes: [0, 0],
        rows: [[1, 10.5]],
      })

      const plan = makeMapRecordPlan('SELECT id, credit FROM Account WHERE id = 1', {
        credit: { type: 'add', value: 1.5 },
      })

      const interpreter = QueryInterpreter.forSql(createInterpreterOptions())
      const result = await interpreter.run(plan, createRuntimeOptions(adapter))

      expect((result as Record<string, unknown>).credit).toBe(12)
    })
  })
})
