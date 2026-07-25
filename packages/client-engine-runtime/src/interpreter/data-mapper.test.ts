import { ColumnTypeEnum } from '@prisma/driver-adapter-utils'
import { expect, test } from 'vitest'

import type { ResultNode } from '../query-plan'
import { applyDataMap, applyDataMapToResultSet, DataMapperError } from './data-mapper'
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

test('maps nested row objects directly like serialized SQL rows', () => {
  const resultSet = {
    columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
    columnNames: ['id', 'author_name'],
    rows: [[1, 'Alice']],
  }
  const structure = {
    type: 'object',
    serializedName: null,
    skipNulls: false,
    fields: {
      id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
      author: {
        type: 'object',
        serializedName: null,
        skipNulls: false,
        fields: {
          name: { type: 'field', dbName: 'author_name', fieldType: { type: 'string', arity: 'scalar' } },
        },
      },
    },
  } satisfies ResultNode

  expect(applyDataMapToResultSet(resultSet, structure, {})).toEqual(
    applyDataMap(serializeSql(resultSet), structure, {}),
  )
})

test('maps JSON value objects directly like serialized SQL rows', () => {
  const resultSet = {
    columnTypes: [ColumnTypeEnum.Json],
    columnNames: ['profile'],
    rows: [['{"display_name":"Alice"}']],
  }
  const structure = {
    type: 'object',
    serializedName: null,
    skipNulls: false,
    fields: {
      profile: {
        type: 'object',
        serializedName: 'profile',
        skipNulls: false,
        fields: {
          displayName: { type: 'field', dbName: 'display_name', fieldType: { type: 'string', arity: 'scalar' } },
        },
      },
    },
  } satisfies ResultNode

  expect(applyDataMapToResultSet(resultSet, structure, {})).toEqual(
    applyDataMap(serializeSql(resultSet), structure, {}),
  )
})

test('throws DataMapperError when a mapped column is missing from the result set', () => {
  const resultSet = {
    columnTypes: [ColumnTypeEnum.Int32],
    columnNames: ['id'],
    rows: [[1]],
  }
  const structure = {
    type: 'object',
    serializedName: null,
    skipNulls: false,
    fields: {
      name: { type: 'field', dbName: 'name', fieldType: { type: 'string', arity: 'scalar' } },
    },
  } satisfies ResultNode

  expect(() => applyDataMapToResultSet(resultSet, structure, {})).toThrowError(DataMapperError)
})

test('direct result-set mapping caches independently for different column orders', () => {
  const structure = {
    type: 'object',
    serializedName: null,
    skipNulls: false,
    fields: {
      id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
      name: { type: 'field', dbName: 'name', fieldType: { type: 'string', arity: 'scalar' } },
    },
  } satisfies ResultNode

  expect(
    applyDataMapToResultSet(
      {
        columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
        columnNames: ['id', 'name'],
        rows: [[1, 'Alice']],
      },
      structure,
      {},
    ),
  ).toEqual([{ id: 1, name: 'Alice' }])

  expect(
    applyDataMapToResultSet(
      {
        columnTypes: [ColumnTypeEnum.Text, ColumnTypeEnum.Int32],
        columnNames: ['name', 'id'],
        rows: [['Bob', 2]],
      },
      structure,
      {},
    ),
  ).toEqual([{ id: 2, name: 'Bob' }])
})
