import { expect, test } from 'vitest'

import { getValidationError } from '../query-plan'
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

test('normalizes compact validation errors', () => {
  expect(getValidationError('r', ['PostToUser', 'Post', 'User'])).toEqual({
    errorIdentifier: 'RELATION_VIOLATION',
    context: { relation: 'PostToUser', modelA: 'Post', modelB: 'User' },
  })

  expect(getValidationError('m', ['Post', 'PostToUser', 'one-to-many', 'connect', 'create'])).toEqual({
    errorIdentifier: 'MISSING_RELATED_RECORD',
    context: {
      model: 'Post',
      relation: 'PostToUser',
      relationType: 'one-to-many',
      operation: 'connect',
      neededFor: 'create',
    },
  })

  expect(getValidationError('M', 'update')).toEqual({
    errorIdentifier: 'MISSING_RECORD',
    context: { operation: 'update' },
  })

  expect(getValidationError('i', 2)).toEqual({
    errorIdentifier: 'INCOMPLETE_CONNECT_INPUT',
    context: { expectedRows: 2 },
  })

  expect(getValidationError('o', [2, 'PostToUser', 'one-to-many'])).toEqual({
    errorIdentifier: 'INCOMPLETE_CONNECT_OUTPUT',
    context: { expectedRows: 2, relation: 'PostToUser', relationType: 'one-to-many' },
  })

  expect(getValidationError('n', ['PostToUser', 'Post', 'User'])).toEqual({
    errorIdentifier: 'RECORDS_NOT_CONNECTED',
    context: { relation: 'PostToUser', parent: 'Post', child: 'User' },
  })
})

test('passes through legacy validation errors', () => {
  expect(
    getValidationError('MISSING_RELATED_RECORD', {
      model: 'Post',
      relation: 'PostToUser',
      relationType: 'one-to-many',
      operation: 'connect',
    }),
  ).toEqual({
    errorIdentifier: 'MISSING_RELATED_RECORD',
    context: {
      model: 'Post',
      relation: 'PostToUser',
      relationType: 'one-to-many',
      operation: 'connect',
    },
  })
})
