import { describe, expect, test } from 'vitest'

import { convertDriverError } from '../errors'

describe('convertDriverError', () => {
  test('maps socket ECONNREFUSED to DatabaseNotReachable', () => {
    const error = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
      syscall: 'connect',
      errno: -111,
      address: '127.0.0.1',
      port: 8000,
    })

    const result = convertDriverError(error)
    expect(result.kind).toBe('DatabaseNotReachable')
    if (result.kind === 'DatabaseNotReachable') {
      expect(result.host).toBe('127.0.0.1')
      expect(result.port).toBe(8000)
    }
  })

  test('maps socket ENOTFOUND to DatabaseNotReachable', () => {
    const error = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
      code: 'ENOTFOUND',
      syscall: 'getaddrinfo',
      errno: -3008,
      hostname: 'unknown.host',
    })

    const result = convertDriverError(error)
    expect(result.kind).toBe('DatabaseNotReachable')
  })

  test('maps socket ETIMEDOUT to SocketTimeout', () => {
    const error = Object.assign(new Error('connect ETIMEDOUT'), {
      code: 'ETIMEDOUT',
      syscall: 'connect',
      errno: -110,
    })

    const result = convertDriverError(error)
    expect(result.kind).toBe('SocketTimeout')
  })

  test('maps socket ECONNRESET to ConnectionClosed', () => {
    const error = Object.assign(new Error('read ECONNRESET'), {
      code: 'ECONNRESET',
      syscall: 'read',
      errno: -104,
    })

    const result = convertDriverError(error)
    expect(result.kind).toBe('ConnectionClosed')
  })

  test('maps TLS error to TlsConnectionError', () => {
    const error = Object.assign(new Error('self signed cert'), {
      code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
    })

    const result = convertDriverError(error)
    expect(result.kind).toBe('TlsConnectionError')
  })

  test('maps authentication error', () => {
    const error = new Error('Authentication failed: invalid credentials')
    const result = convertDriverError(error)
    expect(result.kind).toBe('AuthenticationFailed')
  })

  test('maps unique constraint violation', () => {
    const error = new Error("Record already exists with duplicate unique value for 'email'")
    const result = convertDriverError(error)
    expect(result.kind).toBe('UniqueConstraintViolation')
  })

  test('maps table not found', () => {
    const error = new Error("The table 'users' not found in the database")
    const result = convertDriverError(error)
    expect(result.kind).toBe('TableDoesNotExist')
    if (result.kind === 'TableDoesNotExist') {
      expect(result.table).toBe('users')
    }
  })

  test('maps database not found', () => {
    const error = new Error("The database 'mydb' not found")
    const result = convertDriverError(error)
    expect(result.kind).toBe('DatabaseDoesNotExist')
    if (result.kind === 'DatabaseDoesNotExist') {
      expect(result.db).toBe('mydb')
    }
  })

  test('maps unknown errors to surrealdb kind', () => {
    const error = new Error('Something unexpected happened')
    const result = convertDriverError(error)
    expect(result.kind).toBe('surrealdb')
  })

  test('throws for non-Error values', () => {
    expect(() => convertDriverError('raw string')).toThrow()
  })
})
