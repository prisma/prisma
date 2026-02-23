import { convertDriverError } from './errors'

describe('convertDriverError', () => {
  test('maps postgres server errors', () => {
    const error = {
      code: 'ERR_POSTGRES_SERVER_ERROR',
      errno: '23505',
      severity: 'ERROR',
      detail: 'Key (id)=(1) already exists.',
      message: 'duplicate key value violates unique constraint "users_pkey"',
    }

    expect(convertDriverError(error)).toEqual({
      kind: 'UniqueConstraintViolation',
      constraint: { fields: ['id'] },
      originalCode: '23505',
      originalMessage: error.message,
    })
  })

  test('maps connection closed errors', () => {
    const error = {
      code: 'ERR_POSTGRES_CONNECTION_CLOSED',
      message: 'Connection closed',
    }

    expect(convertDriverError(error)).toEqual({
      kind: 'ConnectionClosed',
    })
  })

  test('maps socket timeout errors', () => {
    const error = {
      code: 'ETIMEDOUT',
      message: 'connect ETIMEDOUT',
      syscall: 'connect',
      errno: -60,
    }

    expect(convertDriverError(error)).toEqual({
      kind: 'SocketTimeout',
    })
  })

  test('throws for unknown errors', () => {
    expect(() => convertDriverError({ message: 'Unknown error' })).toThrow()
  })
})
