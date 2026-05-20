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
    const error = { code, message, syscall: 'connect', errno: -1, address: '127.0.0.1', port: 8080, hostname: 'db.example.turso.io' }
    const mapped = convertDriverError(error)
    expect(mapped.kind).toBe(kind)
    if (kind === 'DatabaseNotReachable') {
      expect(mapped).toMatchObject({ host: '127.0.0.1', port: 8080 })
    }
  })

  test.each([
    ['ENOTFOUND', 'DatabaseNotReachable', 'getaddrinfo ENOTFOUND db.example.turso.io'],
    ['ECONNREFUSED', 'DatabaseNotReachable', 'connect ECONNREFUSED 127.0.0.1:1'],
    ['ECONNRESET', 'ConnectionClosed', 'read ECONNRESET'],
    ['ETIMEDOUT', 'SocketTimeout', 'connect ETIMEDOUT 127.0.0.1:1'],
  ])(
    'socket error %s wrapped in HRANA_WEBSOCKET_ERROR maps to %s',
    (code, kind, causeMessage) => {
      // @libsql/client wraps socket errors inside a LibsqlError with the raw
      // socket error in `cause` (e.g. HRANA_WEBSOCKET_ERROR wrapping ECONNREFUSED).
      const wrapped = {
        code: 'HRANA_WEBSOCKET_ERROR',
        message: causeMessage,
        rawCode: undefined,
        cause: { code, message: causeMessage, syscall: 'connect', errno: -1, address: '127.0.0.1', port: 1 },
      }
      const mapped = convertDriverError(wrapped)
      expect(mapped.kind).toBe(kind)
      if (kind === 'DatabaseNotReachable') {
        expect(mapped).toMatchObject({ host: '127.0.0.1', port: 1 })
      }
    },
  )

  test('non-driver, non-socket error is re-thrown unchanged', () => {
    const input = { message: 'Unknown driver message' }
    expect(() => convertDriverError(input)).toThrowError(
      expect.objectContaining({ message: 'Unknown driver message' }),
    )
  })
})
