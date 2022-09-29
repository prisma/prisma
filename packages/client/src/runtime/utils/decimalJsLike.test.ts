import Decimal from 'decimal.js'

import { isDecimalJsLike, stringifyDecimalJsLike } from './decimalJsLike'

describe('isDecimalJsLike', () => {
  test('true for decimal.js instance', () => {
    expect(isDecimalJsLike(new Decimal('12.3'))).toBe(true)
  })

  test('false for null', () => {
    expect(isDecimalJsLike(null)).toBe(false)
  })

  test('false for primitives', () => {
    expect(isDecimalJsLike(1)).toBe(false)
    expect(isDecimalJsLike('one')).toBe(false)
    expect(isDecimalJsLike(true)).toBe(false)
    expect(isDecimalJsLike(Symbol())).toBe(false)
    expect(isDecimalJsLike(BigInt('123'))).toBe(false)
  })

  test('true for decimal.js-like object', () => {
    const object = {
      d: [12, 3000000],
      e: 1,
      s: 1,
    }
    expect(isDecimalJsLike(object)).toBe(true)
  })

  test('false for object with incorrect `d` property', () => {
    const object = {
      d: 'yes',
      e: 1,
      s: 1,
    }
    expect(isDecimalJsLike(object)).toBe(false)
  })

  test('false for object with incorrect `e` property', () => {
    const object = {
      d: [12, 3000000],
      e: 'one',
      s: 1,
    }
    expect(isDecimalJsLike(object)).toBe(false)
  })

  test('false for object with incorrect `s` property', () => {
    const object = {
      d: [12, 3000000],
      e: 1,
      s: '+',
    }
    expect(isDecimalJsLike(object)).toBe(false)
  })

  test('allows to have extra properties', () => {
    const object = {
      d: [12, 3000000],
      e: 1,
      s: 1,
      something: 'other',
      isFinite() {
        return true
      },
    }
    expect(isDecimalJsLike(object)).toBe(true)
  })
})

describe('stringifyDecimalJsLike', () => {
  test('stringifies Decimal instance', () => {
    expect(stringifyDecimalJsLike(new Decimal('12.3'))).toBe('"12.3"')
  })

  test('stringifies Decimal-like instance', () => {
    const object = {
      d: [12, 3000000],
      e: 1,
      s: 1,
    }
    expect(stringifyDecimalJsLike(object)).toBe('"12.3"')
  })
})
