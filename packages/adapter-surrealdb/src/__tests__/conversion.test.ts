import { ColumnTypeEnum } from '@prisma/driver-adapter-utils'
import { describe, expect, test } from 'vitest'

import { inferColumnType, mapArg, objectToRow } from '../conversion'

describe('inferColumnType', () => {
  test('null returns Text', () => {
    expect(inferColumnType(null)).toBe(ColumnTypeEnum.Text)
  })

  test('undefined returns Text', () => {
    expect(inferColumnType(undefined)).toBe(ColumnTypeEnum.Text)
  })

  test('boolean returns Boolean', () => {
    expect(inferColumnType(true)).toBe(ColumnTypeEnum.Boolean)
    expect(inferColumnType(false)).toBe(ColumnTypeEnum.Boolean)
  })

  test('small integer returns Int32', () => {
    expect(inferColumnType(42)).toBe(ColumnTypeEnum.Int32)
    expect(inferColumnType(-100)).toBe(ColumnTypeEnum.Int32)
    expect(inferColumnType(0)).toBe(ColumnTypeEnum.Int32)
  })

  test('large integer returns Int64', () => {
    expect(inferColumnType(2147483648)).toBe(ColumnTypeEnum.Int64)
    expect(inferColumnType(-2147483649)).toBe(ColumnTypeEnum.Int64)
  })

  test('float returns Double', () => {
    expect(inferColumnType(3.14)).toBe(ColumnTypeEnum.Double)
  })

  test('bigint returns Int64', () => {
    expect(inferColumnType(BigInt(123))).toBe(ColumnTypeEnum.Int64)
  })

  test('plain string returns Text', () => {
    expect(inferColumnType('hello')).toBe(ColumnTypeEnum.Text)
  })

  test('ISO datetime string returns DateTime', () => {
    expect(inferColumnType('2024-01-15T10:30:00Z')).toBe(ColumnTypeEnum.DateTime)
    expect(inferColumnType('2024-01-15T10:30:00.000Z')).toBe(ColumnTypeEnum.DateTime)
  })

  test('ISO date string returns Date', () => {
    expect(inferColumnType('2024-01-15')).toBe(ColumnTypeEnum.Date)
  })

  test('UUID string returns Uuid', () => {
    expect(inferColumnType('550e8400-e29b-41d4-a716-446655440000')).toBe(ColumnTypeEnum.Uuid)
  })

  test('Date object returns DateTime', () => {
    expect(inferColumnType(new Date())).toBe(ColumnTypeEnum.DateTime)
  })

  test('Uint8Array returns Bytes', () => {
    expect(inferColumnType(new Uint8Array([1, 2, 3]))).toBe(ColumnTypeEnum.Bytes)
  })

  test('array returns Json', () => {
    expect(inferColumnType([1, 2, 3])).toBe(ColumnTypeEnum.Json)
  })

  test('object returns Json', () => {
    expect(inferColumnType({ key: 'value' })).toBe(ColumnTypeEnum.Json)
  })
})

describe('objectToRow', () => {
  test('converts object to ordered row array', () => {
    const obj = { id: 'user:1', name: 'Alice', age: 30 }
    const columnNames = ['id', 'name', 'age']
    expect(objectToRow(obj, columnNames)).toEqual(['user:1', 'Alice', 30])
  })

  test('returns null for missing keys', () => {
    const obj = { id: 'user:1' }
    const columnNames = ['id', 'name']
    expect(objectToRow(obj as Record<string, unknown>, columnNames)).toEqual(['user:1', null])
  })

  test('serializes nested objects as JSON', () => {
    const obj = { id: 'user:1', meta: { role: 'admin' } }
    const columnNames = ['id', 'meta']
    const row = objectToRow(obj, columnNames)
    expect(row[0]).toBe('user:1')
    expect(row[1]).toBe('{"role":"admin"}')
  })

  test('serializes Date as ISO string', () => {
    const date = new Date('2024-01-15T10:30:00.000Z')
    const obj = { id: 'user:1', createdAt: date }
    const columnNames = ['id', 'createdAt']
    const row = objectToRow(obj, columnNames)
    expect(row[1]).toBe('2024-01-15T10:30:00.000Z')
  })
})

describe('mapArg', () => {
  test('null returns null', () => {
    expect(mapArg(null, { scalarType: 'string', arity: 'scalar' })).toBeNull()
  })

  test('datetime string converts to Date', () => {
    const result = mapArg('2024-01-15T10:30:00Z', { scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBeInstanceOf(Date)
  })

  test('passes through regular values', () => {
    expect(mapArg(42, { scalarType: 'int', arity: 'scalar' })).toBe(42)
    expect(mapArg('hello', { scalarType: 'string', arity: 'scalar' })).toBe('hello')
    expect(mapArg(true, { scalarType: 'boolean', arity: 'scalar' })).toBe(true)
  })

  test('list arity maps each element', () => {
    const result = mapArg([1, 2, 3], { scalarType: 'int', arity: 'list' })
    expect(result).toEqual([1, 2, 3])
  })
})
