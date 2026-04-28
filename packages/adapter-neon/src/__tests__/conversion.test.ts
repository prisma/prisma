import { describe, expect, it } from 'vitest'

import { customParsers, mapArg } from '../conversion'

const TIMESTAMPTZ_OID = 1184 // PostgreSQL ScalarColumnType.TIMESTAMPTZ
const TIMETZ_ARRAY_OID = 1270 // PostgreSQL timetz[]

describe('mapArg', () => {
  it('converts a date with a 4-digit year (value >= 1000-01-01) to the correct date', () => {
    const date = new Date('1999-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATE', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('1999-12-31')
  })

  it('converts a date with a 3-digit year (0100-01-01 <= value < 1000-01-01) to the correct date', () => {
    const date = new Date('0999-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATE', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('0999-12-31')
  })

  it('converts a date with a 2-digit year (0000-01-01 <= value < 0100-01-01) to the correct date', () => {
    const date = new Date('0099-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATE', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('0099-12-31')
  })

  it('converts a date with a 4-digit year (value >= 1000-01-01) to the correct datetime', () => {
    const date = new Date('1999-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATETIME', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('1999-12-31 23:59:59.999+00:00')
  })

  it('converts a date with a 3-digit year (0100-01-01 <= value < 1000-01-01) to the correct datetime', () => {
    const date = new Date('0999-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATETIME', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('0999-12-31 23:59:59.999+00:00')
  })

  it('converts a date with a 2-digit year (0000-01-01 <= value < 0100-01-01) to the correct datetime', () => {
    const date = new Date('0099-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATETIME', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('0099-12-31 23:59:59.999+00:00')
  })
})

describe('normalize_timestamptz', () => {
  const parse = customParsers[TIMESTAMPTZ_OID] as (s: string) => string

  it('replaces space separator with T and rewrites offset to +00:00', () => {
    expect(parse('2025-11-24 09:26:34.887-06')).toBe('2025-11-24T09:26:34.887+00:00')
  })

  it('handles ±HH:MM offsets', () => {
    expect(parse('2024-01-01 20:30:00+05:30')).toBe('2024-01-01T20:30:00+00:00')
  })

  it('handles bare ±HH offset without adding fractional seconds', () => {
    // Must not add .000 — matches adapter-pg output.
    expect(parse('2024-06-15 12:00:00+00')).toBe('2024-06-15T12:00:00+00:00')
  })

  it('preserves fractional seconds as-is', () => {
    expect(parse('2024-03-10 23:59:59.123-01')).toBe('2024-03-10T23:59:59.123+00:00')
  })

  it('preserves microsecond (6-digit) fractional seconds without truncation', () => {
    expect(parse('2025-11-24 09:26:34.887654-06')).toBe('2025-11-24T09:26:34.887654+00:00')
  })
})

describe('TIMETZ_ARRAY custom parser (OID 1270)', () => {
  const parse = customParsers[TIMETZ_ARRAY_OID] as (s: string) => string[]

  it('is registered so timetz[] columns do not throw', () => {
    expect(parse).toBeDefined()
  })

  it('parses a timetz[] literal and strips the offset from each element', () => {
    // normalize_timez drops the offset (UTC is assumed, consistent with quaint).
    expect(parse('{"09:26:34+00","12:00:00-05:30"}')).toEqual(['09:26:34', '12:00:00'])
  })
})
