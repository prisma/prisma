import { ColumnTypeEnum } from '@prisma/driver-adapter-utils'
import { expect, test } from 'vitest'

import type { ResultNode } from '../query-plan'
import { applyDataMap, applyDataMapToResultSet } from './data-mapper'
import { serializeSql } from './serialize-sql'

test('maps result sets directly like serialized SQL rows', () => {
  const resultSet = {
    columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
    columnNames: ['id', 'name'],
    rows: [
      [1, 'Alice'],
      [2, 'Bob'],
    ],
  }
  const structure = {
    type: 'object',
    serializedName: null,
    skipNulls: false,
    fields: {
      id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
      name: { type: 'field', dbName: 'name', fieldType: { type: 'string', arity: 'scalar' } },
    },
  } satisfies ResultNode

  expect(applyDataMapToResultSet(resultSet, structure, {})).toEqual(
    applyDataMap(serializeSql(resultSet), structure, {}),
  )
})

test('direct result-set mapping uses the last duplicate column name', () => {
  const resultSet = {
    columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Int32],
    columnNames: ['id', 'id'],
    rows: [[1, 2]],
  }
  const structure = {
    type: 'object',
    serializedName: null,
    skipNulls: false,
    fields: {
      id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
    },
  } satisfies ResultNode

  expect(applyDataMapToResultSet(resultSet, structure, {})).toEqual(
    applyDataMap(serializeSql(resultSet), structure, {}),
  )
})
