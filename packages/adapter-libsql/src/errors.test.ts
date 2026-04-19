import { describe, expect, test } from 'vitest'

import { convertDriverError } from './errors'

describe('LibSQL error handling', () => {
  test('missing error code gets defaulted to 1', () => {
    const dbError = convertDriverError({ code: '123456', message: 'An error occurred', rawCode: undefined })
    expect(dbError).toEqual({
      kind: 'sqlite',
      message: 'An error occurred',
      extendedCode: 1,
      originalMessage: 'An error occurred',
    })
  })

  test.each([
    ['ENOTFOUND', 'DatabaseNotReachable', 'getaddrinfo ENOTFOUND db.example.turso.io'],
    ['ECONNREFUSED', 'DatabaseNotReachable', 'connect ECONNREFUSED 127.0.0.1:8080'],
    ['ECONNRESET', 'ConnectionClosed', 'read ECONNRESET'],
    ['ETIMEDOUT', 'SocketTimeout', 'connect ETIMEDOUT 127.0.0.1:8080'],
  ])('socket error %s maps to %s and is not misclassified as a sqlite error', (code, kind, message) => {
    // Socket errors have a string `code` and undefined `rawCode`, so without an
    // explicit guard they would pass isDriverError and be returned as
    // { kind: 'sqlite', extendedCode: 1 } — the wrong kind.
    const error = { code, message, syscall: 'connect', errno: -1 }
    expect(convertDriverError(error)).toEqual({ kind })
  })

  test('non-driver, non-socket error is re-thrown', () => {
    expect(() => convertDriverError({ message: 'Unknown driver message' })).toThrow()
  })
})
