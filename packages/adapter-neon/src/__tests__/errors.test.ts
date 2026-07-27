import { describe, expect, it } from 'vitest'

import { convertDriverError } from '../errors'

describe('convertDriverError', () => {
  it.each(['40001', '40P01'])('should handle TransactionWriteConflict (%s)', (code) => {
    const error = { code, message: 'msg', severity: 'ERROR' }
    expect(convertDriverError(error)).toEqual({
      kind: 'TransactionWriteConflict',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle NullConstraintViolation (23502) using error.column', () => {
    const error = {
      code: '23502',
      message: 'null value in column "foo" of relation "User" violates not-null constraint',
      severity: 'ERROR',
      detail: 'Failing row contains (null, null, null).',
      column: 'foo',
    }
    expect(convertDriverError(error)).toEqual({
      kind: 'NullConstraintViolation',
      constraint: { fields: ['foo'] },
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should return undefined constraint for NullConstraintViolation (23502) without error.column', () => {
    const error = {
      code: '23502',
      message: 'null value in column "foo" violates not-null constraint',
      severity: 'ERROR',
    }
    expect(convertDriverError(error)).toEqual({
      kind: 'NullConstraintViolation',
      constraint: undefined,
      originalCode: error.code,
      originalMessage: error.message,
    })
  })
})
