import * as mariadb from 'mariadb'
import { describe, expect, it } from 'vitest'

import { mapArg, mapRow } from './conversion'

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

describe('mapArg returns Date for datetime to let driver handle timezone', () => {
  it('returns the original Date object for DATETIME columns (lets driver handle timezone)', () => {
    const inputDate = new Date('2026-07-16T16:39:36.363+08:00')

    // @ts-ignore - testing with a mock argType
    const result = mapArg(inputDate, { dbType: 'DATETIME' })

    expect(result).toBe(inputDate)
  })

  it('returns the original Date object for TIMESTAMP columns', () => {
    const inputDate = new Date('2026-07-16T16:39:36.363+05:00')

    // @ts-ignore - testing with a mock argType
    const result = mapArg(inputDate, { dbType: 'TIMESTAMP' })

    expect(result).toBe(inputDate)
  })

  it('still formats TIME columns to string', () => {
    const inputDate = new Date('1970-01-01T14:30:00.000Z')

    // @ts-ignore - testing with a mock argType
    const result = mapArg(inputDate, { dbType: 'TIME' })

    expect(typeof result).toBe('string')
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}(\.\d{3})?$/)
  })

  it('still formats DATE columns to string', () => {
    const inputDate = new Date('2026-07-16T00:00:00.000Z')

    // @ts-ignore - testing with a mock argType
    const result = mapArg(inputDate, { dbType: 'DATE' })

    expect(typeof result).toBe('string')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
