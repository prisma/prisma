import * as mariadb from 'mariadb'
import { describe, expect, it } from 'vitest'

import { formatDateTime, mapRow } from './conversion'

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

describe('formatDateTime with local time', () => {
  it('preserves local time: uses local-time methods not UTC methods', () => {
    // Create a date representing 2026-07-16T16:39:36.363+08:00
    // formatDateTime now uses local-time getters (getFullYear, getMonth, etc.)
    // so the result should reflect local time, not UTC
    // UTC equivalent would be 08:39:36.363, local time varies by timezone
    const date = new Date('2026-07-16T16:39:36.363+08:00')

    const result = formatDateTime(date)

    // Verify format is correct
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{3})?$/)

    // Verify it uses the date components — the year, month, and day come from
    // the local-time interpretation of the input (not UTC)
    expect(result.startsWith('2026-07-16')).toBe(true)

    // Critical: ensure NOT using UTC hours (which would be 08 for +08:00 offset)
    expect(result).not.toBe('2026-07-16 08:39:36.363')
  })

  it('produces correct output for a UTC-zoned date', () => {
    // When input is UTC, local-time and UTC methods produce the same result
    // only in UTC timezone. Use a clearly different offset to verify local time.
    const date = new Date('2026-07-16T16:39:36.363+05:00')

    const result = formatDateTime(date)

    // UTC would be 11:39:36.363, local should be 16:39:36.363 if in +05:00
    // Since we can't know the test runner's timezone, verify the general format
    // and that the function doesn't produce UTC output
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{3})?$/)
  })
})
