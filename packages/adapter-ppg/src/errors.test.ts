import { describe, expect, it } from 'vitest'

import { convertDriverError } from './errors'

describe('convertDriverError', () => {
  it.each([
    ['unquoted column name', 'column foo does not exist', 'foo'],
    ['quoted column name', 'column "foo" does not exist', 'foo'],
    ['unquoted qualified column name', 'column users.first_name does not exist', 'users.first_name'],
    ['quoted qualified column name', 'column "users"."first name" does not exist', 'users.first name'],
    ['partially quoted qualified column name (1)', 'column users."first name" does not exist', 'users.first name'],
    ['partially quoted qualified column name (2)', 'column "users".first_name does not exist', 'users.first_name'],
    ['quoted column name containing spaces', 'column "first name" does not exist', 'first name'],
    ['quoted column name containing dots', 'column "first.name" does not exist', 'first.name'],
    ['quoted qualified column name containing dots', 'column "users"."first.name" does not exist', 'users.first.name'],
    ['quoted column name containing escaped quotes', 'column "a""b" does not exist', 'a"b'],
  ])('should handle ColumnNotFound (42703) with %s', (_description, message, expectedColumn) => {
    const error = { code: '42703', message, details: { severity: 'ERROR' } }
    expect(convertDriverError(error)).toEqual({
      kind: 'ColumnNotFound',
      column: expectedColumn,
      originalCode: error.code,
      originalMessage: error.message,
    })
  })
})
