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
  const structure = [
    null,
    {
      id: 'i',
      name: 's',
    },
  ] satisfies ResultNode

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
  const structure = [
    null,
    {
      id: 'i',
      name: 's',
    },
  ] satisfies ResultNode

  expect(applyDataMap(serializeSql(resultSet), structure, {})).toEqual([{ id: 1, name: 'Alice' }])
  expect(applyDataMapToResultSet(resultSet, structure, {})).toEqual([{ id: 1, name: 'Alice' }])
})

test('maps compact result object nodes', () => {
  const resultSet = {
    columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
    columnNames: ['id', 'type'],
    rows: [[1, 'admin']],
  }
  const structure = [
    null,
    {
      id: 'i',
      type: 's',
    },
  ] satisfies ResultNode

  expect(applyDataMap(serializeSql(resultSet), structure, {})).toEqual([{ id: 1, type: 'admin' }])
  expect(applyDataMapToResultSet(resultSet, structure, {})).toEqual([{ id: 1, type: 'admin' }])
})

test('maps compact result object nodes with serialized names', () => {
  const structure = [
    null,
    {
      profile: [
        'profile',
        {
          id: 'i',
          type: 's',
        },
      ],
    },
  ] satisfies ResultNode

  expect(applyDataMap([{ profile: { id: 1, type: 'admin' } }], structure, {})).toEqual([
    { profile: { id: 1, type: 'admin' } },
  ])
})

test('direct result-set mapping uses the last duplicate column name', () => {
  const resultSet = {
    columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Int32],
    columnNames: ['id', 'id'],
    rows: [[1, 2]],
  }
  const structure = [
    null,
    {
      id: 'i',
    },
  ] satisfies ResultNode

  expect(applyDataMapToResultSet(resultSet, structure, {})).toEqual(
    applyDataMap(serializeSql(resultSet), structure, {}),
  )
})

test('direct result-set mapping caches independently for different column orders', () => {
  const structure = [
    null,
    {
      id: 'i',
      name: 's',
    },
  ] satisfies ResultNode

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

test('rejects legacy field result nodes with a type discriminator', () => {
  const structure = [
    null,
    {
      id: { type: 'field', dbName: 'id', fieldType: { type: 'i', arity: 'scalar' } },
    },
  ] as unknown as ResultNode

  expect(() => applyDataMap([{ id: 1 }], structure, {})).toThrow(/Invalid data mapping node type/)
})
