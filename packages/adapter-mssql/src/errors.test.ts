import { describe, expect, it } from 'vitest'

import { convertDriverError } from './errors'

describe('convertDriverError', () => {
  it('should handle AuthenticationFailed (18456)', () => {
    const error = { code: 'ELOGIN', number: 18456, message: "Login failed for user 'sa'.", severity: 14 }
    expect(convertDriverError(error)).toEqual({
      kind: 'AuthenticationFailed',
      user: 'sa',
      originalCode: 'ELOGIN',
      originalMessage: error.message,
    })
  })

  it('should handle UniqueConstraintViolation (2627)', () => {
    const error = {
      code: 'EREQUEST',
      number: 2627,
      message:
        "Violation of UNIQUE KEY constraint 'UQ_User_email'. Cannot insert duplicate key in object 'dbo.User'. The duplicate key value is (foo@bar.com).",
      severity: 14,
    }
    const result = convertDriverError(error)
    expect(result).toMatchObject({
      kind: 'UniqueConstraintViolation',
      constraint: { index: 'UQ_User_email' },
      originalCode: 'EREQUEST',
    })
  })

  it('should handle NullConstraintViolation (515)', () => {
    const error = {
      code: 'EREQUEST',
      number: 515,
      message: "Cannot insert the value NULL into column 'email', table 'dbo.User'; column does not allow nulls.",
      severity: 16,
    }
    expect(convertDriverError(error)).toMatchObject({
      kind: 'NullConstraintViolation',
      constraint: { fields: ['email'] },
      originalCode: 'EREQUEST',
    })
  })

  it('should handle TransactionWriteConflict (1205)', () => {
    const error = { code: 'EREQUEST', number: 1205, message: 'Deadlock found.', severity: 13 }
    expect(convertDriverError(error)).toEqual({
      kind: 'TransactionWriteConflict',
      originalCode: 'EREQUEST',
      originalMessage: error.message,
    })
  })

  it('should handle default (unknown code)', () => {
    const error = { code: 'EREQUEST', number: 99999, message: 'unknown error', severity: 16 }
    expect(convertDriverError(error)).toEqual({
      kind: 'mssql',
      code: 99999,
      message: 'unknown error',
      originalCode: 'EREQUEST',
      originalMessage: error.message,
    })
  })

  it.each([
    ['ENOTFOUND', 'DatabaseNotReachable', 'getaddrinfo ENOTFOUND myserver.database.windows.net'],
    ['ECONNREFUSED', 'DatabaseNotReachable', 'connect ECONNREFUSED 127.0.0.1:1433'],
    ['ECONNRESET', 'ConnectionClosed', 'read ECONNRESET'],
    ['ETIMEDOUT', 'SocketTimeout', 'connect ETIMEDOUT 127.0.0.1:1433'],
  ])('should handle socket error %s and not misclassify as a driver error', (code, kind, message) => {
    // Without the isSocketError guard these would fall through to throw because
    // mssql socket errors lack the numeric `number` field that isDriverError requires.
    const error = {
      code,
      message,
      syscall: 'connect',
      errno: -1,
      address: '127.0.0.1',
      port: 1433,
      hostname: 'myserver.database.windows.net',
    }
    const mapped = convertDriverError(error)
    expect(mapped.kind).toBe(kind)
    if (kind === 'DatabaseNotReachable') {
      expect(mapped).toMatchObject({ host: '127.0.0.1', port: 1433 })
    }
  })

  it('should throw for unrecognised errors', () => {
    expect(() => convertDriverError({ message: 'unknown message' })).toThrow()
  })
})
