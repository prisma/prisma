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

  it.each(['40001', '40P01'])('should handle TransactionWriteConflict (%s)', (code) => {
    const error = { code, message: 'msg', details: { severity: 'ERROR' } }
    expect(convertDriverError(error)).toEqual({
      kind: 'TransactionWriteConflict',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle NullConstraintViolation (23502) using the reported column', () => {
    const error = {
      code: '23502',
      message: 'null value in column "foo" of relation "User" violates not-null constraint',
      details: { severity: 'ERROR', detail: 'Failing row contains (null, null, null).', column: 'foo' },
    }
    expect(convertDriverError(error)).toEqual({
      kind: 'NullConstraintViolation',
      constraint: { fields: ['foo'] },
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should return undefined constraint for NullConstraintViolation (23502) without a reported column', () => {
    const error = {
      code: '23502',
      message: 'null value in column "foo" violates not-null constraint',
      details: { severity: 'ERROR' },
    }
    expect(convertDriverError(error)).toEqual({
      kind: 'NullConstraintViolation',
      constraint: undefined,
      originalCode: error.code,
      originalMessage: error.message,
    })
  })
})
