import { describe, expect, it } from 'vitest'

import { mapArg } from '../conversion'

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

  it('converts a date to the correct TIMESTAMPTZ string (with timezone offset)', () => {
    // Use a date with a known timezone offset
    // For UTC, the offset is always +0000
    const date = new Date('2020-01-02T03:04:05.678Z')
    const result = mapArg(date, { dbType: 'TIMESTAMPTZ', scalarType: 'datetime', arity: 'scalar' })
    // The expected format is: YYYY-MM-DD HH:mm:ss.SSS+ZZZZ
    // For UTC, offset is +0000
    expect(result).toBe('2020-01-02 03:04:05.678+0000')
  })

  it('converts a date with a non-UTC timezone offset to the correct TIMESTAMPTZ string', () => {
    // Simulate a date in a different timezone by adjusting the time
    // For example, UTC+2: 2020-01-02T03:04:05.678+02:00 is 2020-01-02T01:04:05.678Z
    // But JS Date always stores UTC, so we can only test the output format for the local timezone
    // We'll mock getTimezoneOffset to simulate a non-UTC offset
    const date = new Date('2020-01-02T03:04:05.678Z')
    const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset.bind(Date.prototype)
    Date.prototype.getTimezoneOffset = function (this: void) {
      return -120
    } // UTC+2
    const result = mapArg(date, { dbType: 'TIMESTAMPTZ', scalarType: 'datetime', arity: 'scalar' })
    // The expected offset is +0200
    expect(result).toBe('2020-01-02 03:04:05.678+0200')
    Date.prototype.getTimezoneOffset = originalGetTimezoneOffset
  })
})
