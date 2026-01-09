import { describe, expect, it } from 'vitest'

import { allAllowedProtocols } from '../logic/adapter'
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
    ['postgres connection string', 'postgres://user:password@localhost:5432/database', '[REDACTED]'],
    ['postgresql connection string', 'postgresql://user:password@localhost:5432/database', '[REDACTED]'],
    [
      'jdbc:sqlserver connection string',
      'jdbc:sqlserver://localhost:1433;database=test;user=sa;password=pass',
      '[REDACTED]',
    ],
    ['sqlserver connection string', 'sqlserver://localhost:1433;database=test;user=sa;password=pass', '[REDACTED]'],
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
    expect(() => rethrowSanitizedError(error, allAllowedProtocols)).toThrow(expected)
  })

  it('preserves error messages without connection strings', () => {
    const error = new Error('Generic database error')
    expect(() => rethrowSanitizedError(error, allAllowedProtocols)).toThrow('Generic database error')
  })

  it('preserves error properties other than message', () => {
    const error = new Error('mysql://user:pass@host:3306/db connection failed')
    error.name = 'DatabaseError'

    try {
      rethrowSanitizedError(error, allAllowedProtocols)
    } catch (caughtError) {
      expect(caughtError).toBeInstanceOf(Error)
      expect((caughtError as Error).name).toBe('DatabaseError')
      expect((caughtError as Error).message).toBe('[REDACTED] connection failed')
    }
  })

  it('rethrows non-Error values unchanged', () => {
    expect(() => rethrowSanitizedError('string error', allAllowedProtocols)).toThrow('string error')
  })

  it('sanitizes connection strings in AggregateError with nested aggregates', () => {
    const nestedAggregate = new AggregateError(
      [
        new Error('Nested error: mysql://nested:pass@host3:3306/nested'),
        new Error('Another nested: mariadb://nested2:secret@host4:3306/nested2'),
      ],
      'Nested aggregate error',
    )

    const aggregateError = new AggregateError(
      [
        new Error('Connection failed: mysql://user:pass@host1:3306/db1'),
        new Error('Another failure: postgresql://user:pass@host2:5432/db2'),
        nestedAggregate,
      ],
      'Multiple connection errors',
    )

    try {
      rethrowSanitizedError(aggregateError, allAllowedProtocols)
    } catch (caughtError) {
      expect(caughtError).toBeInstanceOf(AggregateError)
      const caught = caughtError as AggregateError
      expect(caught.message).toBe('Multiple connection errors')
      expect(caught.errors).toHaveLength(3)
      expect(caught.errors[0].message).toBe('Connection failed: [REDACTED]')
      expect(caught.errors[1].message).toBe('Another failure: [REDACTED]')

      const nestedCaught = caught.errors[2] as AggregateError
      expect(nestedCaught).toBeInstanceOf(AggregateError)
      expect(nestedCaught.message).toBe('Nested aggregate error')
      expect(nestedCaught.errors).toHaveLength(2)
      expect(nestedCaught.errors[0].message).toBe('Nested error: [REDACTED]')
      expect(nestedCaught.errors[1].message).toBe('Another nested: [REDACTED]')
    }
  })

  it('handles deeply recursive error cause chain', () => {
    const deepError = new Error('Deep error with mysql://user:pass@host:3306/deep')
    const middleError = new Error('Middle error', { cause: deepError })
    const rootError = new Error('Root error with postgresql://admin:secret@server:5432/root', { cause: middleError })

    try {
      rethrowSanitizedError(rootError, allAllowedProtocols)
    } catch (caughtError) {
      expect(caughtError).toBeInstanceOf(Error)
      expect((caughtError as Error).message).toBe('Root error with [REDACTED]')

      const cause1 = (caughtError as Error).cause as Error
      expect(cause1.message).toBe('Middle error')

      const cause2 = cause1.cause as Error
      expect(cause2.message).toBe('Deep error with [REDACTED]')
    }
  })

  it('sanitizes connection strings in arbitrary error properties', () => {
    const error = new Error('Generic error')
    ;(error as any).config = {
      url: 'mysql://admin:password123@prod-server:3306/app_db',
      fallbackUrl: 'postgresql://backup:secret@backup-server:5432/app_db',
    }
    ;(error as any).debugInfo = 'Connection attempt to mysql://backup:secret@localhost:3306/backup_db failed'
    ;(error as any).nested = {
      connectionString: 'sqlserver://user:pass@cluster.example.com:1433/database',
    }

    try {
      rethrowSanitizedError(error, allAllowedProtocols)
    } catch (caughtError) {
      expect(caughtError).toBeInstanceOf(Error)
      expect((caughtError as Error).message).toBe('Generic error')

      const caught = caughtError as any
      expect(caught.config.url).toBe('[REDACTED]')
      expect(caught.config.fallbackUrl).toBe('[REDACTED]')
      expect(caught.debugInfo).toBe('Connection attempt to [REDACTED] failed')
      expect(caught.nested.connectionString).toBe('[REDACTED]')
    }
  })

  it('handles cyclic error references without infinite recursion', () => {
    const error1 = new Error('Error 1 with mysql://user:pass@host1:3306/db1')
    const error2 = new Error('Error 2 with postgresql://admin:secret@host2:5432/db2')

    // Create a cycle: error1.cause -> error2, error2.cause -> error1
    error1.cause = error2
    error2.cause = error1

    // Also add cyclic property reference
    ;(error1 as any).relatedError = error2
    ;(error2 as any).relatedError = error1

    try {
      rethrowSanitizedError(error1, allAllowedProtocols)
    } catch (caughtError) {
      expect(caughtError).toBeInstanceOf(Error)
      expect((caughtError as Error).message).toBe('Error 1 with [REDACTED]')

      const cause = (caughtError as Error).cause as Error
      expect(cause.message).toBe('Error 2 with [REDACTED]')

      // Verify the cycle is preserved but sanitized
      expect(cause.cause).toBe(caughtError) // Should point back to error1
      expect((caughtError as any).relatedError).toBe(cause) // Should point to error2
      expect((cause as any).relatedError).toBe(caughtError) // Should point back to error1
    }
  })
})
