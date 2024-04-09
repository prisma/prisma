import { Cache } from './Cache'

test('creating an item', () => {
  const cache = new Cache<string, string>()
  const result = cache.getOrCreate('foo', () => 'hello!')

  expect(result).toBe('hello!')
})

test('retrieving an item', () => {
  const cache = new Cache<string, object>()
  const result1 = cache.getOrCreate('foo', () => ({ value: 'hello!' }))
  const result2 = cache.getOrCreate('foo', () => ({ value: 'hello!' }))

  expect(result2).toBe(result1)
})

test('creating items with different keys', () => {
  const cache = new Cache<string, object>()
  const result1 = cache.getOrCreate('foo', () => ({ value: 'hello!' }))
  const result2 = cache.getOrCreate('bar', () => ({ value: 'hello!' }))

  expect(result2).not.toBe(result1)
})

test('retrieving an does not trigger callback', () => {
  const callback = jest.fn().mockReturnValue('hello!')
  const cache = new Cache<string, object>()
  cache.getOrCreate('foo', callback)
  cache.getOrCreate('foo', callback)

  expect(callback).toHaveBeenCalledTimes(1)
})

test('it is possible to store undefined values', () => {
  const callback = jest.fn().mockReturnValue(undefined)
  const cache = new Cache<string, undefined>()
  cache.getOrCreate('foo', callback)
  cache.getOrCreate('foo', callback)

  expect(callback).toHaveBeenCalledTimes(1)
})
