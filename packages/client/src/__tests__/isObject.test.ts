import Decimal from 'decimal.js'

import { isObject } from '../runtime/utils/isObject'

test('is true for proper object', () => {
  expect(isObject({})).toBe(true)
})

test('is false for null', () => {
  expect(isObject(null)).toBe(false)
})

test('is false for primitive types', () => {
  expect(isObject(1)).toBe(false)
  expect(isObject(undefined)).toBe(false)
  expect(isObject('hello')).toBe(false)
  expect(isObject(true)).toBe(false)
  expect(isObject(BigInt('10'))).toBe(false)
  expect(isObject(Symbol())).toBe(false)
})

test('is false for Dates', () => {
  expect(isObject(new Date('2022-05-06T00:00:00Z'))).toBe(false)
})

test('is false for Decimal.js instance', () => {
  expect(isObject(new Decimal('12.34'))).toBe(false)
})

test('is false for Buffer', () => {
  expect(isObject(Buffer.from('hello', 'utf8'))).toBe(false)
})
