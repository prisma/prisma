import * as mariadb from 'mariadb'
import { describe, expect, it } from 'vitest'

import { mapRow } from './conversion'

describe('mapRow', () => {
  it('maps datetime columns from object rows to ISO strings', () => {
    const row = { createdAt: '2024-01-02 03:04:05.000' }

    const result = mapRow(row, [{ type: 'DATETIME' } as unknown as mariadb.FieldInfo])

    expect(result).toEqual(['2024-01-02T03:04:05+00:00'])
  })

  it('maps bigint columns from object rows to strings', () => {
    const row = { id: 123n }

    const result = mapRow(row, [{ type: 'BIGINT' } as unknown as mariadb.FieldInfo])

    expect(result).toEqual(['123'])
  })

  it('maps buffer columns to Uint8Array views', () => {
    const source = Buffer.from([0, 1, 2, 3, 4])
    const value = source.subarray(1, 4)
    const row = { data: value }

    const result = mapRow(row, [{ type: 'BLOB' } as unknown as mariadb.FieldInfo])
    const mapped = result[0] as Uint8Array

    expect(Buffer.isBuffer(mapped)).toBe(false)
    expect(mapped).toBeInstanceOf(Uint8Array)
    expect(mapped.buffer).toBe(value.buffer)
    expect(mapped.byteOffset).toBe(value.byteOffset)
    expect(mapped.byteLength).toBe(value.byteLength)
    expect(mapped).toEqual(Uint8Array.from([1, 2, 3]))
  })

  it('preserves property order for mixed object rows', () => {
    const row = {
      createdAt: '2024-01-02 03:04:05.123',
      id: 5n,
      note: null,
    }

    const result = mapRow(row, [
      { type: 'DATETIME' } as unknown as mariadb.FieldInfo,
      { type: 'BIGINT' } as unknown as mariadb.FieldInfo,
      { type: 'VARCHAR' } as unknown as mariadb.FieldInfo,
    ])

    expect(result).toEqual(['2024-01-02T03:04:05.123+00:00', '5', null])
  })
})
