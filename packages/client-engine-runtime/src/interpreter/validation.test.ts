import { expect, test } from 'vitest'

import { doesSatisfyRule } from './validation'

test('checks compact data rules', () => {
  expect(doesSatisfyRule([1, 2], ['=', 2])).toBe(true)
  expect(doesSatisfyRule([1, 2], ['!', 1])).toBe(true)
  expect(doesSatisfyRule(3, ['a', 3])).toBe(true)
  expect(doesSatisfyRule([1, 2], 'n')).toBe(false)
})

test('checks legacy data rules', () => {
  expect(doesSatisfyRule([1, 2], { type: 'rowCountEq', args: 2 })).toBe(true)
  expect(doesSatisfyRule([1, 2], { type: 'rowCountNeq', args: 1 })).toBe(true)
  expect(doesSatisfyRule(3, { type: 'affectedRowCountEq', args: 3 })).toBe(true)
  expect(doesSatisfyRule([1, 2], { type: 'never' })).toBe(false)
})
