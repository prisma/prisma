import { describe, expect, it } from 'vitest'

import { convertDriverError } from '../errors'

describe('convertDriverError', () => {
  it('should handle LengthMismatch (22001)', () => {
    const error = { code: '22001', column: 'foo', message: 'msg', severity: 'ERROR' }
    expect(convertDriverError(error)).toEqual({
      kind: 'LengthMismatch',
      column: 'foo',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle ValueOutOfRange (22003)', () => {
    const error = { code: '22003', message: 'out of range', severity: 'ERROR' }
    expect(convertDriverError(error)).toEqual({
      kind: 'ValueOutOfRange',
      cause: 'out of range',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle InvalidInputValue (22P02)', () => {
    const error = { code: '22P02', message: 'invalid input value for enum "Status": "INVALID"', severity: 'ERROR' }
    expect(convertDriverError(error)).toEqual({
      kind: 'InvalidInputValue',
      message: 'invalid input value for enum "Status": "INVALID"',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle UniqueConstraintViolation (23505)', () => {
    const error = { code: '23505', message: 'msg', severity: 'ERROR', detail: 'Key (id)' }
    expect(convertDriverError(error)).toEqual({
      kind: 'UniqueConstraintViolation',
      constraint: { fields: ['id'] },
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle NullConstraintViolation (23502)', () => {
    const error = { code: '23502', message: 'msg', severity: 'ERROR', detail: 'Key (foo)' }
    expect(convertDriverError(error)).toEqual({
      kind: 'NullConstraintViolation',
      constraint: { fields: ['foo'] },
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle ForeignKeyConstraintViolation (23503) with column', () => {
    const error = { code: '23503', message: 'msg', severity: 'ERROR', column: 'bar' }
    expect(convertDriverError(error)).toEqual({
      kind: 'ForeignKeyConstraintViolation',
      constraint: { fields: ['bar'] },
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle ForeignKeyConstraintViolation (23503) with constraint', () => {
    const error = { code: '23503', message: 'msg', severity: 'ERROR', constraint: 'baz' }
    expect(convertDriverError(error)).toEqual({
      kind: 'ForeignKeyConstraintViolation',
      constraint: { index: 'baz' },
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle DatabaseDoesNotExist (3D000)', () => {
    const error = { code: '3D000', message: 'database "mydb" does not exist', severity: 'ERROR' }
    expect(convertDriverError(error)).toEqual({
      kind: 'DatabaseDoesNotExist',
      db: 'mydb',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle DatabaseAccessDenied (28000)', () => {
    const error = {
      code: '28000',
      message: 'no pg_hba.conf entry for host "172.20.20.2", user "db_user", database "prisma_db", no encryption',
      severity: 'FATAL',
    }
    expect(convertDriverError(error)).toEqual({
      kind: 'DatabaseAccessDenied',
      db: 'prisma_db',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle AuthenticationFailed (28P01)', () => {
    const error = { code: '28P01', message: 'password authentication failed for user "root"', severity: 'ERROR' }
    expect(convertDriverError(error)).toEqual({
      kind: 'AuthenticationFailed',
      user: 'root',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle TransactionWriteConflict (40001)', () => {
    const error = { code: '40001', message: 'msg', severity: 'ERROR' }
    expect(convertDriverError(error)).toEqual({
      kind: 'TransactionWriteConflict',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle TableDoesNotExist (42P01)', () => {
    const error = { code: '42P01', message: 'relation "mytable" does not exist', severity: 'ERROR' }
    expect(convertDriverError(error)).toEqual({
      kind: 'TableDoesNotExist',
      table: 'mytable',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle ColumnNotFound (42703)', () => {
    const error = { code: '42703', message: 'column "foo" does not exist', severity: 'ERROR' }
    expect(convertDriverError(error)).toEqual({
      kind: 'ColumnNotFound',
      column: 'foo',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle DatabaseAlreadyExists (42P04)', () => {
    const error = { code: '42P04', message: 'database "mydb" already exists', severity: 'ERROR' }
    expect(convertDriverError(error)).toEqual({
      kind: 'DatabaseAlreadyExists',
      db: 'mydb',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should handle TooManyConnections (53300)', () => {
    const error = { code: '53300', message: 'too many connections', severity: 'ERROR' }
    expect(convertDriverError(error)).toEqual({
      kind: 'TooManyConnections',
      cause: 'too many connections',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it.each([
    ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'unable to verify the first certificate'],
    [
      'ERR_TLS_CERT_ALTNAME_INVALID',
      `Hostname/IP does not match certificate's altnames: Host: localhost. is not in the cert's altnames: DNS:*.localdev.com`,
    ],
    [undefined, 'The server does not support SSL connections'],
  ])('should handle TLS error code %s', (code, message) => {
    const error = { code, message }
    expect(convertDriverError(error)).toEqual({
      kind: 'TlsConnectionError',
      reason: message,
    })
  })

  it.each([
    ['ENOTFOUND', 'DatabaseNotReachable', 'getaddrinfo ENOTFOUND locohost'],
    ['ECONNREFUSED', 'DatabaseNotReachable', `connect ECONNREFUSED 127.0.0.1:6699`],
    ['ECONNRESET', 'ConnectionClosed', 'read ECONNRESET'],
    ['ETIMEDOUT', 'SocketTimeout', 'connect ETIMEDOUT 127.0.0.1:9100'],
  ])('should handle socket error code %s', (code, kind, message) => {
    const error = { code, message, syscall: 'syscallname', errno: -1 }
    expect(convertDriverError(error)).toEqual({
      kind,
    })
  })

  it('should handle default (unknown code)', () => {
    const error = {
      code: '99999',
      message: 'unknown',
      severity: 'FATAL',
      detail: 'details',
      column: 'col',
      hint: 'hint',
    }
    expect(convertDriverError(error)).toEqual({
      kind: 'postgres',
      code: '99999',
      severity: 'FATAL',
      message: 'unknown',
      detail: 'details',
      column: 'col',
      hint: 'hint',
      originalCode: error.code,
      originalMessage: error.message,
    })
  })

  it('should throw if not a db error', () => {
    expect(() => convertDriverError({ message: 'Unknown driver message' })).toThrow()
  })
})
