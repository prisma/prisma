import { type LibsqlError } from '@libsql/client'
import { Error as DriverAdapterErrorObject, MappedError } from '@prisma/driver-adapter-utils'

const SQLITE_BUSY = 5
const PRIMARY_ERROR_CODE_MASK = 0xff

const SOCKET_ERRORS = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'])

export function convertDriverError(error: unknown): DriverAdapterErrorObject {
  // Socket errors must be checked before isDriverError because they satisfy the
  // LibsqlError type shape (string code, string message, undefined rawCode) and
  // would otherwise be misclassified as SQLite errors with extendedCode 1.
  if (isSocketError(error)) {
    return mapSocketError(error)
  }

  if (isDriverError(error)) {
    return {
      originalCode: error.rawCode?.toString(),
      originalMessage: error.message,
      ...mapDriverError(error),
    }
  }

  throw error
}

export function mapDriverError(error: LibsqlError): MappedError {
  const rawCode: number = error.rawCode ?? error.cause?.['rawCode'] ?? 1
  switch (rawCode) {
    case 2067:
    case 1555: {
      const fields = error.message
        .split('constraint failed: ')
        .at(1)
        ?.split(', ')
        .map((field) => field.split('.').pop()!)
      return {
        kind: 'UniqueConstraintViolation',
        constraint: fields !== undefined ? { fields } : undefined,
      }
    }
    case 1299: {
      const fields = error.message
        .split('constraint failed: ')
        .at(1)
        ?.split(', ')
        .map((field) => field.split('.').pop()!)
      return {
        kind: 'NullConstraintViolation',
        constraint: fields !== undefined ? { fields } : undefined,
      }
    }
    case 787:
    case 1811:
      return {
        kind: 'ForeignKeyConstraintViolation',
        constraint: { foreignKey: {} },
      }
    default:
      if (rawCode && (rawCode & PRIMARY_ERROR_CODE_MASK) === SQLITE_BUSY) {
        return {
          kind: 'SocketTimeout',
        }
      } else if (error.message.startsWith('no such table')) {
        return {
          kind: 'TableDoesNotExist',
          table: error.message.split(': ').at(1),
        }
      } else if (error.message.startsWith('no such column')) {
        return {
          kind: 'ColumnNotFound',
          column: error.message.split(': ').at(1),
        }
      } else if (error.message.includes('has no column named ')) {
        return {
          kind: 'ColumnNotFound',
          column: error.message.split('has no column named ').at(1),
        }
      }

      return {
        kind: 'sqlite',
        extendedCode: rawCode,
        message: error.message,
      }
  }
}

function isDriverError(error: any): error is LibsqlError {
  return (
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    (typeof error.rawCode === 'number' || error.rawCode === undefined)
  )
}

type SocketError = Error & {
  code: 'ENOTFOUND' | 'ECONNREFUSED' | 'ECONNRESET' | 'ETIMEDOUT'
  syscall: string
  errno: number
  address?: string | undefined
  port?: number | undefined
  hostname?: string | undefined
}

function isSocketError(error: any): error is SocketError {
  return (
    typeof error.code === 'string' &&
    typeof error.syscall === 'string' &&
    typeof error.errno === 'number' &&
    SOCKET_ERRORS.has(error.code as string)
  )
}

function mapSocketError(error: SocketError): MappedError {
  switch (error.code) {
    case 'ENOTFOUND':
    case 'ECONNREFUSED':
      return {
        kind: 'DatabaseNotReachable',
        host: error.address ?? error.hostname,
        port: error.port,
      }
    case 'ECONNRESET':
      return {
        kind: 'ConnectionClosed',
      }
    case 'ETIMEDOUT':
      return {
        kind: 'SocketTimeout',
      }
  }
}
