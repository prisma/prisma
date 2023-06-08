import Decimal from 'decimal.js'

import { deserializeJsonResponse } from './deserialize'

test('primitives', () => {
  expect(deserializeJsonResponse(1)).toBe(1)
  expect(deserializeJsonResponse('foo')).toBe('foo')
  expect(deserializeJsonResponse(null)).toBe(null)
  expect(deserializeJsonResponse(false)).toBe(false)
})

test('Date', () => {
  const value = deserializeJsonResponse({ $type: 'DateTime', value: '1980-01-02T00:00:00.000Z' })
  expect(value).toBeInstanceOf(Date)
  expect(value).toEqual(new Date('1980-01-02T00:00:00.000Z'))
})

test('BigInt', () => {
  const value = deserializeJsonResponse({ $type: 'BigInt', value: '123' })
  expect(value).toBe(123n)
})

test('Bytes', () => {
  const value = deserializeJsonResponse({ $type: 'Bytes', value: 'aGVsbG8gd29ybGQ=' })
  expect(value).toBeInstanceOf(Buffer)
  expect(value).toEqual(Buffer.from('hello world'))
})

test('Decimal', () => {
  const value = deserializeJsonResponse({ $type: 'Decimal', value: '123.45' })
  expect(value).toBeInstanceOf(Decimal)
  expect(value).toEqual(new Decimal('123.45'))
})

test('Json', () => {
  const value = deserializeJsonResponse({ $type: 'Json', value: '{"foo":123}' })
  expect(value).toEqual({ foo: 123 })
})

test('object', () => {
  expect(
    deserializeJsonResponse({
      name: 'John',
      height: 173.45,
      money: { $type: 'Decimal', value: '123.45' },
      profile: {
        birthday: { $type: 'DateTime', value: '1980-01-02T00:00:00.000Z' },
      },
    }),
  ).toEqual({
    name: 'John',
    height: 173.45,
    money: new Decimal('123.45'),
    profile: {
      birthday: new Date('1980-01-02T00:00:00.000Z'),
    },
  })
})

test('array', () => {
  expect(deserializeJsonResponse(['foo', 123, { $type: 'BigInt', value: '123' }])).toEqual(['foo', 123, 123n])
})
