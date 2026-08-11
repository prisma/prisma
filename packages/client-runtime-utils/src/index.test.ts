import { describe, expect, it } from 'vitest'

import { Decimal } from './index'

describe('Decimal relational operators', () => {
  // Regression test for https://github.com/prisma/prisma/issues/29882
  //
  // decimal.js `valueOf()` returns a string, so `<`, `>`, `<=`, `>=` between two
  // Decimals used to compare the decimal strings lexicographically:
  //   new Decimal('10.1') < new Decimal('9.99')   // was true (10.1 > 9.99)
  //   new Decimal('2') < new Decimal('10')        // was false (2 < 10)
  it('compares by numeric value instead of by string', () => {
    const d = (value: string) => new Decimal(value)

    expect(d('10.1') < d('9.99')).toBe(false)
    expect(d('2') < d('10')).toBe(true)
    expect(d('9.99') >= d('10.1')).toBe(false)
    expect(d('10.00') <= d('10.00')).toBe(true)
    expect(d('1.5') > d('1.50')).toBe(false) // equal values, trailing zeros
  })

  it('keeps Number() coercion numeric', () => {
    expect(Number(new Decimal('10.5'))).toBe(10.5)
    expect(+new Decimal('10.5')).toBe(10.5)
  })

  it('keeps string coercion and JSON output unchanged', () => {
    const d = new Decimal('10.10')

    // decimal.js canonicalizes a trailing-zero precision to its shortest form;
    // the point is that the valueOf override does NOT change string/JSON output.
    expect(String(d)).toBe('10.1')
    expect(`${d}`).toBe('10.1')
    expect(d.toString()).toBe('10.1')
    expect(d.toJSON()).toBe('10.1')
    expect(JSON.stringify(new Decimal('2.50'))).toBe('"2.5"')
  })
})
