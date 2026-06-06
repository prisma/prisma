import { Decimal } from '@prisma/client-runtime-utils'
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

test('maps compact scalar field nodes', () => {
  const resultSet = {
    columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
    columnNames: ['id', 'name'],
    rows: [[1, 'Alice']],
  }
  const structure = {
    type: 'object',
    serializedName: null,
    skipNulls: false,
    fields: {
      id: 'int',
      name: 'string',
    },
  } satisfies ResultNode

  expect(applyDataMap(serializeSql(resultSet), structure, {})).toEqual([{ id: 1, name: 'Alice' }])
  expect(applyDataMapToResultSet(resultSet, structure, {})).toEqual([{ id: 1, name: 'Alice' }])
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

test('direct result-set mapping can return native JavaScript values', () => {
  const resultSet = {
    columnTypes: [
      ColumnTypeEnum.Int64,
      ColumnTypeEnum.Numeric,
      ColumnTypeEnum.DateTime,
      ColumnTypeEnum.Bytes,
      ColumnTypeEnum.Json,
    ],
    columnNames: ['bigint', 'decimal', 'createdAt', 'bytes', 'json'],
    rows: [['123', '12.34', '2024-01-15T12:00:00Z', 'aGVsbG8=', '{"nested":true}']],
  }
  const structure = {
    type: 'object',
    serializedName: null,
    skipNulls: false,
    fields: {
      bigint: { type: 'field', dbName: 'bigint', fieldType: { type: 'bigint', arity: 'scalar' } },
      decimal: { type: 'field', dbName: 'decimal', fieldType: { type: 'decimal', arity: 'scalar' } },
      createdAt: { type: 'field', dbName: 'createdAt', fieldType: { type: 'datetime', arity: 'scalar' } },
      bytes: { type: 'field', dbName: 'bytes', fieldType: { type: 'bytes', encoding: 'base64', arity: 'scalar' } },
      json: { type: 'field', dbName: 'json', fieldType: { type: 'json', arity: 'scalar' } },
    },
  } satisfies ResultNode

  const [row] = applyDataMapToResultSet(resultSet, structure, {}, 'js')

  expect(row.bigint).toBe(123n)
  expect(row.decimal).toEqual(new Decimal('12.34'))
  expect(row.createdAt).toEqual(new Date('2024-01-15T12:00:00Z'))
  expect(row.bytes).toEqual(new Uint8Array([104, 101, 108, 108, 111]))
  expect(row.json).toEqual({ nested: true })
})
