import { ColumnTypeEnum } from '@prisma/driver-adapter-utils'
import { expect, test } from 'vitest'

import { serializeRawSql, serializeSql } from './serialize-sql'

test('should serialize empty rows', () => {
  const result = serializeSql({
    columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
    columnNames: ['id', 'name'],
    rows: [],
  })
  expect(result).toEqual([])
})

test('should serialize a flat list of rows', () => {
  const result = serializeSql({
    columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
    columnNames: ['id', 'name'],
    rows: [
      [1, 'Alice'],
      [2, 'Bob'],
    ],
  })
  expect(result).toEqual([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ])
})

test('should serialize raw SQL with geometry columns', () => {
  const point = { type: 'Point' as const, coordinates: [1, 2], srid: 4326 }
  const result = serializeRawSql({
    columnTypes: [ColumnTypeEnum.Point, ColumnTypeEnum.GeometryArray],
    columnNames: ['position', 'positions'],
    rows: [[point, [point, point]]],
  })
  expect(result.columns).toEqual(['position', 'positions'])
  expect(result.types).toEqual(['geometry', 'geometry-array'])
  expect(result.rows).toEqual([[point, [point, point]]])
})
