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

  it('still formats TIME columns to string (uses UTC getters)', () => {
    // Use a UTC time not near midnight so the UTC hour is preserved
    // regardless of host timezone. Using 14:30:00.000Z guarantees the
    // formatted hour will be 14 in any timezone offset.
    const inputDate = new Date('2027-06-15T14:30:00.000Z')

    // @ts-ignore - testing with a mock argType
    const result = mapArg(inputDate, { dbType: 'TIME' })

    expect(typeof result).toBe('string')
    // formatTime uses UTC getters, so result matches UTC components exactly
    expect(result).toBe('14:30:00')
  })

  it('still formats DATE columns to string (uses local getters)', () => {
    // Use a UTC time at noon so the local date is unambiguous in any timezone.
    // At noon UTC, even UTC-12 rolls forward only to 00:00 next day (not noon),
    // so the local date is always July 16 in all timezones.
    const inputDate = new Date('2026-07-16T12:00:00.000Z')

    // @ts-ignore - testing with a mock argType
    const result = mapArg(inputDate, { dbType: 'DATE' })

    expect(typeof result).toBe('string')
    // formatDate uses local getters (getFullYear/getMonth/getDate)
    expect(result).toBe('2026-07-16')
  })
})
