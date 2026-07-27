import { describe, expect, it } from 'vitest'

import { convertDriverError } from '../errors'

describe('convertDriverError', () => {
  it('should handle UniqueConstraintViolation (23505) with only detail', () => {
    const error = { code: '23505', message: 'msg', severity: 'ERROR', detail: 'Key (id)' }
    expect(convertDriverError(error)).toEqual({
      kind: 'UniqueConstraintViolation',
      constraint: { fields: ['id'] },
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle UniqueConstraintViolation (23505) with constraint', () => {
    const error = { code: '23505', message: 'msg', severity: 'ERROR', detail: 'Key (id)', constraint: 'users_id_key' }
    expect(convertDriverError(error)).toEqual({
      kind: 'UniqueConstraintViolation',
      constraint: { index: 'users_id_key' },
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle UniqueConstraintViolation (23505) with only constraint', () => {
    const error = { code: '23505', message: 'msg', severity: 'ERROR', constraint: 'users_email_key' }
    expect(convertDriverError(error)).toEqual({
      kind: 'UniqueConstraintViolation',
      constraint: { index: 'users_email_key' },
      originalCode: error.code,
      originalMessage: error.message,
    })
  })
})
