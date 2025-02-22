import { ColumnTypeEnum } from '@prisma/driver-adapter-utils'

import { serialize } from './serialize'

test('should serialize empty rows', () => {
  const result = serialize({
    columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
    columnNames: ['id', 'name'],
    rows: [],
  })
  expect(result).toEqual([])
})

test('should serialize a flat list of rows', () => {
  const result = serialize({
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

test('should serialize a list of rows with nested rows', () => {
  const result = serialize({
    columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Float, ColumnTypeEnum.Float, ColumnTypeEnum.Text],
    columnNames: ['id', '_avg.age', '_avg.height', 'deeply.nested.value'],
    rows: [
      [1, 20, 180, 'dummy1'],
      [2, 30, 190, 'dummy2'],
    ],
  })
  expect(result).toEqual([
    { id: 1, _avg: { age: 20, height: 180 }, deeply: { nested: { value: 'dummy1' } } },
    { id: 2, _avg: { age: 30, height: 190 }, deeply: { nested: { value: 'dummy2' } } },
  ])
})
