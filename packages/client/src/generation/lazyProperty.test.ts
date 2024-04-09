import { lazyProperty } from './lazyProperty'

test('returns callback value', () => {
  const prop = lazyProperty(jest.fn().mockReturnValue(123))
  expect(prop.get()).toBe(123)
})

test('computes property only once', () => {
  const compute = jest.fn().mockReturnValue(123)
  const prop = lazyProperty(compute)
  prop.get()
  prop.get()
  expect(compute).toHaveBeenCalledTimes(1)
})

test('caches undefined values', () => {
  const compute = jest.fn().mockReturnValue(undefined)
  const prop = lazyProperty(compute)
  prop.get()
  prop.get()
  expect(compute).toHaveBeenCalledTimes(1)
})

test('caches null values', () => {
  const compute = jest.fn().mockReturnValue(null)
  const prop = lazyProperty(compute)
  prop.get()
  prop.get()
  expect(compute).toHaveBeenCalledTimes(1)
})
