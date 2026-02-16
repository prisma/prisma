import { describe, expect, test } from 'vitest'

import { builtinParsers, ScalarColumnType } from './conversion'

function getParser(oid: number) {
  const entry = builtinParsers.find((p) => p.oid === oid)
  if (!entry) {
    throw new Error(`No parser registered for OID ${oid}`)
  }
  return entry.parse
}

describe('conversion', () => {
  describe('null handling in type parsers', () => {
    test('normalize_timestamp returns null for null input', () => {
      const parse = getParser(ScalarColumnType.TIMESTAMP)
      expect(parse(null as unknown as string)).toBeNull()
    })

    test('normalize_timestamptz returns null for null input', () => {
      const parse = getParser(ScalarColumnType.TIMESTAMPTZ)
      expect(parse(null as unknown as string)).toBeNull()
    })

    test('normalize_timez returns null for null input', () => {
      const parse = getParser(ScalarColumnType.TIMETZ)
      expect(parse(null as unknown as string)).toBeNull()
    })

    test('normalize_money returns null for null input', () => {
      const parse = getParser(ScalarColumnType.MONEY)
      expect(parse(null as unknown as string)).toBeNull()
    })

    test('normalize_bool returns null for null input', () => {
      const parse = getParser(ScalarColumnType.BOOL)
      expect(parse(null as unknown as string)).toBeNull()
    })

    test('convertBytes returns null for null input', () => {
      const parse = getParser(ScalarColumnType.BYTEA)
      expect(parse(null as unknown as string)).toBeNull()
    })
  })

  describe('normalize_timestamp', () => {
    const parse = getParser(ScalarColumnType.TIMESTAMP)

    test('converts space separator to T and appends UTC offset', () => {
      expect(parse('1996-12-19 16:39:57')).toBe('1996-12-19T16:39:57+00:00')
    })

    test('preserves fractional seconds', () => {
      expect(parse('2024-01-15 08:30:00.123456')).toBe('2024-01-15T08:30:00.123456+00:00')
    })
  })

  describe('normalize_timestamptz', () => {
    const parse = getParser(ScalarColumnType.TIMESTAMPTZ)

    test('normalizes positive offset to UTC', () => {
      expect(parse('1996-12-19 16:39:57+05:30')).toBe('1996-12-19T16:39:57+00:00')
    })

    test('normalizes negative offset to UTC', () => {
      expect(parse('2024-01-15 08:30:00-08:00')).toBe('2024-01-15T08:30:00+00:00')
    })

    test('normalizes short offset format', () => {
      expect(parse('2024-01-15 08:30:00+05')).toBe('2024-01-15T08:30:00+00:00')
    })
  })

  describe('normalize_timez', () => {
    const parse = getParser(ScalarColumnType.TIMETZ)

    test('strips timezone offset', () => {
      expect(parse('16:39:57+05:30')).toBe('16:39:57')
    })

    test('strips negative offset', () => {
      expect(parse('08:30:00-08:00')).toBe('08:30:00')
    })
  })

  describe('normalize_money', () => {
    const parse = getParser(ScalarColumnType.MONEY)

    test('strips leading currency symbol', () => {
      expect(parse('$1234.56')).toBe('1234.56')
    })
  })

  describe('normalize_bool', () => {
    const parse = getParser(ScalarColumnType.BOOL)

    test('converts f to false', () => {
      expect(parse('f')).toBe('false')
    })

    test('converts t to true', () => {
      expect(parse('t')).toBe('true')
    })
  })

  describe('convertBytes', () => {
    const parse = getParser(ScalarColumnType.BYTEA)

    test('converts base64 string to Buffer', () => {
      const result = parse('aGVsbG8=')
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.toString('utf8')).toBe('hello')
    })
  })
})
