import { maxBy } from './maxBy'

test('empty array', () => {
  expect(maxBy([], () => 1)).toBe(undefined)
})

test('with items', () => {
  const items = [{ count: 1 }, { count: 10 }, { count: 5 }]
  expect(maxBy(items, (item) => item.count)).toBe(items[1])
})
