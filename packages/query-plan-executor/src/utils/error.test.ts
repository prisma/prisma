import { describe, expect, it } from 'vitest'

import { extractErrorFromUnknown, rethrowSanitizedError } from './error'

describe('extractErrorFromUnknown', () => {
  it('returns the same Error object', () => {
    const originalError = new Error('test error')
    const result = extractErrorFromUnknown(originalError)
    expect(result).toEqual(originalError)
  })

  it('converts string to string', () => {
    const result = extractErrorFromUnknown('test string')
    expect(result).toEqual('test string')
  })

  it('converts number to string', () => {
    const result = extractErrorFromUnknown(42)
    expect(result).toEqual('42')
  })

  it('converts boolean to string', () => {
    const result = extractErrorFromUnknown(true)
    expect(result).toEqual('true')
  })

  it('converts object to string', () => {
    const testObj = { foo: 'bar' }
    const result = extractErrorFromUnknown(testObj)
    expect(result).toEqual('[object Object]')
  })

  it('converts null to string', () => {
    const result = extractErrorFromUnknown(null)
    expect(result).toEqual('null')
  })

  it('converts undefined to string', () => {
    const result = extractErrorFromUnknown(undefined)
    expect(result).toEqual('undefined')
  })
})

describe('rethrowSanitizedError', () => {
  it.each([
    ['basic mysql connection string', 'mysql://user:password@localhost:3306/database', '[REDACTED]'],
    ['mariadb connection string', 'mariadb://user:password@localhost:3306/database', '[REDACTED]'],
    ['postgresql connection string', 'postgresql://user:password@localhost:5432/database', '[REDACTED]'],
    [
      'jdbc:sqlserver connection string',
      'jdbc:sqlserver://localhost:1433;database=test;user=sa;password=pass',
      '[REDACTED]',
    ],
    ['sqlserver connection string', 'sqlserver://localhost:1433;database=test;user=sa;password=pass', '[REDACTED]'],
    ['sqlite connection string', 'sqlite://path/to/database.db', '[REDACTED]'],
    ['mongodb connection string', 'mongodb://user:password@localhost:27017/database', '[REDACTED]'],
    [
      'connection string with context',
      'Connection failed: mysql://user:password@localhost:3306/db',
      'Connection failed: [REDACTED]',
    ],
    [
      'multiple connection strings',
      'Failed to connect to mysql://user:pass@host1:3306/db1 or postgresql://user:pass@host2:5432/db2',
      'Failed to connect to [REDACTED] or [REDACTED]',
    ],
    [
      'quoted connection string',
      'Connection string "mysql://user:pass@host:3306/db" is invalid',
      'Connection string [REDACTED] is invalid',
    ],
    [
      'single-quoted connection string',
      "Connection string 'postgresql://user:pass@host:5432/db' failed",
      'Connection string [REDACTED] failed',
    ],
    [
      'backtick-quoted connection string',
      'Connection string `mysql://user:pass@host:3306/db` could not be parsed',
      'Connection string [REDACTED] could not be parsed',
    ],
    [
      'complex connection string with special characters',
      'postgresql://user%40domain:p%40ssw0rd@localhost:5432/my_database?sslmode=require',
      '[REDACTED]',
    ],
  ])('sanitizes %s', (_description, input, expected) => {
    const error = new Error(input)
    expect(() => rethrowSanitizedError(error)).toThrow(expected)
  })

  it('preserves error messages without connection strings', () => {
    const error = new Error('Generic database error')
    expect(() => rethrowSanitizedError(error)).toThrow('Generic database error')
  })

  it('preserves error properties other than message', () => {
    const error = new Error('mysql://user:pass@host:3306/db connection failed')
    error.name = 'DatabaseError'
    const originalStack = error.stack

    try {
      rethrowSanitizedError(error)
    } catch (caughtError) {
      expect(caughtError).toBeInstanceOf(Error)
      expect((caughtError as Error).name).toBe('DatabaseError')
      expect((caughtError as Error).stack).toBe(originalStack)
      expect((caughtError as Error).message).toBe('[REDACTED] connection failed')
    }
  })

  it('rethrows non-Error values unchanged', () => {
    expect(() => rethrowSanitizedError('string error')).toThrow('string error')
  })
})
