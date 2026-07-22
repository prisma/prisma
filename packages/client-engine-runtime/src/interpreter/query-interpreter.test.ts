import { ColumnTypeEnum, SqlQuery, SqlQueryable, SqlResultSet } from '@prisma/driver-adapter-utils'
import { expect, test } from 'vitest'

import type { PlaceholderFormat, QueryPlanNode } from '../query-plan'
import { noopTracingHelper } from '../tracing'
import { QueryInterpreter } from './query-interpreter'

function resultSetWithRows(rowCount: number): SqlResultSet {
  return {
    columnNames: ['id'],
    columnTypes: [ColumnTypeEnum.Int32],
    rows: Array.from({ length: rowCount }, (_, i) => [i]),
  }
}

// Regression test for https://github.com/prisma/prisma/issues/29746: merging the rows of a chunked
// query used to spread the whole result set onto the stack (`results.rows.push(...result.rows)`),
// overflowing the call stack when a single chunk returned hundreds of thousands of rows.
test('merges chunked query results without overflowing the stack', async () => {
  const rowsPerLaterChunk = 200_000

  let call = 0
  const queryable: SqlQueryable = {
    provider: 'postgres',
    adapterName: 'test',
    queryRaw: (_query: SqlQuery) => {
      call++
      // The first chunk yields no rows so the whole result set is delivered by the second chunk
      // through the spread-based merge path that used to overflow the stack.
      return Promise.resolve(resultSetWithRows(call === 1 ? 0 : rowsPerLaterChunk))
    },
    executeRaw: () => Promise.resolve(0),
  }

  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    connectionInfo: { maxBindValues: 2, supportsRelationJoins: false },
  })

  const queryPlan: QueryPlanNode = {
    type: 'query',
    args: {
      type: 'templateSql',
      fragments: [
        { type: 'stringChunk', chunk: 'SELECT * FROM users WHERE "id" IN ' },
        { type: 'parameterTuple', itemPrefix: '', itemSeparator: ',', itemSuffix: '' },
      ],
      placeholderFormat: {
        prefix: '$',
        hasNumbering: true,
      } satisfies PlaceholderFormat,
      args: [[1, 2, 3, 4]],
      argTypes: [{ arity: 'scalar', scalarType: 'int' }],
      chunkable: true,
    },
  }

  const result = await interpreter.run(queryPlan, {
    queryable,
    transactionManager: { enabled: false },
    scope: {},
  })

  expect(call).toBe(2)
  expect(result).toHaveLength(rowsPerLaterChunk)
})
