import { ColumnTypeEnum } from '@prisma/driver-adapter-utils'

import { getColumnTypes, mapArg, mapRow } from './conversion'

describe('mapArg', () => {
  test('maps date and byte args', () => {
    const date = new Date('1999-12-31T23:59:59.999Z')
    const datetime = mapArg(date, { dbType: 'DATETIME', scalarType: 'datetime', arity: 'scalar' })
    const dateOnly = mapArg(date, { dbType: 'DATE', scalarType: 'datetime', arity: 'scalar' })
    const time = mapArg(date, { dbType: 'TIME', scalarType: 'datetime', arity: 'scalar' })
    const bytes = mapArg('AQID', { scalarType: 'bytes', arity: 'scalar' })

    expect(datetime).toBe('1999-12-31 23:59:59.999')
    expect(dateOnly).toBe('1999-12-31')
    expect(time).toBe('23:59:59.999')
    expect(bytes).toEqual(Buffer.from([1, 2, 3]))
  })
})

describe('result conversion', () => {
  test('infers column types from values and maps rows', () => {
    const columnNames = ['i64', 'num', 'json', 'date', 'bytes', 'i64_arr']
    const rows = [
      [1n, '1.25', { a: 1 }, new Date('2024-01-01T00:00:00.000Z'), Buffer.from([1, 2]), [1n, 2n]],
      [2n, '2.50', { b: 2 }, new Date('2024-01-02T00:00:00.000Z'), Buffer.from([3, 4]), [3n, 4n]],
    ]

    const columnTypes = getColumnTypes(columnNames, rows)
    expect(columnTypes).toEqual([
      ColumnTypeEnum.Int64,
      ColumnTypeEnum.Numeric,
      ColumnTypeEnum.Json,
      ColumnTypeEnum.DateTime,
      ColumnTypeEnum.Bytes,
      ColumnTypeEnum.Int64Array,
    ])

    const mapped = rows.map((row) => mapRow(row, columnTypes))
    expect(mapped[0]).toEqual([
      '1',
      '1.25',
      JSON.stringify({ a: 1 }),
      '2024-01-01T00:00:00.000+00:00',
      new Uint8Array([1, 2]),
      ['1', '2'],
    ])
  })

  test('falls back to int32 for all-null columns', () => {
    const columnTypes = getColumnTypes(['nullable'], [[null], [null]])
    expect(columnTypes).toEqual([ColumnTypeEnum.Int32])
  })
})
