// @ts-ignore: this is used to avoid the `Module '"<path>/node_modules/@types/pg/index"' has no default export.` error.
import pg from 'pg'
import { describe, expect, it } from 'vitest'

import { customParsers, mapArg } from '../conversion'

const { types } = pg
const { builtins: ScalarColumnType } = types

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
    expect(result).toBe('1999-12-31 23:59:59.999')
  })

  it('converts a date with a 3-digit year (0100-01-01 <= value < 1000-01-01) to the correct datetime', () => {
    const date = new Date('0999-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATETIME', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('0999-12-31 23:59:59.999')
  })

  it('converts a date with a 2-digit year (0000-01-01 <= value < 0100-01-01) to the correct datetime', () => {
    const date = new Date('0099-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATETIME', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('0099-12-31 23:59:59.999')
  })
})

describe('customParsers', () => {
  describe('TIMESTAMP parser (normalize_timestamp)', () => {
    const parser = customParsers[ScalarColumnType.TIMESTAMP]

    it('correctly parses year 31 AD timestamp', () => {
      const result = parser('0031-01-01 00:00:00')
      expect(result).toBe('0031-01-01T00:00:00+00:00')
    })

    it('correctly parses year 32 AD timestamp', () => {
      const result = parser('0032-01-01 00:00:00')
      expect(result).toBe('0032-01-01T00:00:00+00:00')
    })

    it('correctly parses year 40 AD timestamp', () => {
      const result = parser('0040-01-01 00:00:00')
      expect(result).toBe('0040-01-01T00:00:00+00:00')
    })

    it('correctly parses year 50 AD timestamp', () => {
      const result = parser('0050-01-01 00:00:00')
      expect(result).toBe('0050-01-01T00:00:00+00:00')
    })

    it('correctly parses year 99 AD timestamp', () => {
      const result = parser('0099-12-31 23:59:59')
      expect(result).toBe('0099-12-31T23:59:59+00:00')
    })

    it('correctly parses year 120 AD timestamp', () => {
      const result = parser('0120-01-01 00:00:00')
      expect(result).toBe('0120-01-01T00:00:00+00:00')
    })

    it('correctly parses timestamp with milliseconds', () => {
      const result = parser('0040-06-15 12:30:45.123')
      expect(result).toBe('0040-06-15T12:30:45.123+00:00')
    })

    it('correctly parses timestamp with microseconds (truncated to milliseconds)', () => {
      const result = parser('0031-03-20 08:15:30.123456')
      expect(result).toBe('0031-03-20T08:15:30.123+00:00')
    })

    it('correctly parses modern date timestamp', () => {
      const result = parser('1999-12-31 23:59:59.999')
      expect(result).toBe('1999-12-31T23:59:59.999+00:00')
    })

    it('correctly parses 3-digit year timestamp', () => {
      const result = parser('0999-06-15 12:00:00')
      expect(result).toBe('0999-06-15T12:00:00+00:00')
    })
  })

  describe('TIMESTAMPTZ parser (normalize_timestampz)', () => {
    const parser = customParsers[ScalarColumnType.TIMESTAMPTZ]

    it('correctly parses year 31 AD timestamptz', () => {
      const result = parser('0031-01-01 00:00:00+00')
      expect(result).toBe('0031-01-01T00:00:00+00:00')
    })

    it('correctly parses year 32 AD timestamptz', () => {
      const result = parser('0032-01-01 00:00:00+00')
      expect(result).toBe('0032-01-01T00:00:00+00:00')
    })

    it('correctly parses year 40 AD timestamptz', () => {
      const result = parser('0040-01-01 00:00:00+00')
      expect(result).toBe('0040-01-01T00:00:00+00:00')
    })

    it('correctly parses year 50 AD timestamptz', () => {
      const result = parser('0050-01-01 00:00:00+00')
      expect(result).toBe('0050-01-01T00:00:00+00:00')
    })

    it('correctly parses year 99 AD timestamptz', () => {
      const result = parser('0099-12-31 23:59:59+00')
      expect(result).toBe('0099-12-31T23:59:59+00:00')
    })

    it('correctly parses year 120 AD timestamptz', () => {
      const result = parser('0120-01-01 00:00:00+00')
      expect(result).toBe('0120-01-01T00:00:00+00:00')
    })

    it('correctly parses timestamptz with positive timezone offset', () => {
      const result = parser('0040-06-15 12:30:45+05:30')
      expect(result).toBe('0040-06-15T07:00:45+00:00')
    })

    it('correctly parses timestamptz with negative timezone offset', () => {
      const result = parser('0031-03-20 08:15:30-08:00')
      expect(result).toBe('0031-03-20T16:15:30+00:00')
    })

    it('correctly parses timestamptz with milliseconds and timezone', () => {
      const result = parser('0050-01-15 10:20:30.456+02')
      expect(result).toBe('0050-01-15T08:20:30.456+00:00')
    })

    it('correctly parses modern date timestamptz', () => {
      const result = parser('1999-12-31 23:59:59.999+00')
      expect(result).toBe('1999-12-31T23:59:59.999+00:00')
    })

    it('correctly parses 3-digit year timestamptz', () => {
      const result = parser('0999-06-15 12:00:00+00')
      expect(result).toBe('0999-06-15T12:00:00+00:00')
    })
  })
})
