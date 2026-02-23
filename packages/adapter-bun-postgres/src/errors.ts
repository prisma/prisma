import { Error as DriverAdapterErrorObject, MappedError } from '@prisma/driver-adapter-utils'

type BunPostgresError = Error & {
  code?: string
  errno?: string | number
  severity?: string
  detail?: string
  hint?: string
  constraint?: string
  table?: string
  schema?: string
  routine?: string
  file?: string
}

const TLS_ERRORS = new Set([
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_CRL',
  'UNABLE_TO_DECRYPT_CERT_SIGNATURE',
  'UNABLE_TO_DECRYPT_CRL_SIGNATURE',
  'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY',
  'CERT_SIGNATURE_FAILURE',
  'CRL_SIGNATURE_FAILURE',
  'CERT_NOT_YET_VALID',
  'CERT_HAS_EXPIRED',
  'CRL_NOT_YET_VALID',
  'CRL_HAS_EXPIRED',
  'ERROR_IN_CERT_NOT_BEFORE_FIELD',
  'ERROR_IN_CERT_NOT_AFTER_FIELD',
  'ERROR_IN_CRL_LAST_UPDATE_FIELD',
  'ERROR_IN_CRL_NEXT_UPDATE_FIELD',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_CHAIN_TOO_LONG',
  'CERT_REVOKED',
  'INVALID_CA',
  'INVALID_PURPOSE',
  'CERT_UNTRUSTED',
  'CERT_REJECTED',
  'HOSTNAME_MISMATCH',
  'ERR_TLS_CERT_ALTNAME_FORMAT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
])

const SOCKET_ERRORS = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'])

export function convertDriverError(error: unknown): DriverAdapterErrorObject {
  if (isSocketError(error)) {
    return mapSocketError(error)
  }

  if (isConnectionClosedError(error)) {
    return {
      kind: 'ConnectionClosed',
    }
  }

  if (isTlsError(error)) {
    return {
      kind: 'TlsConnectionError',
      reason: error.message,
    }
  }

  if (isServerError(error)) {
    const sqlState = String(error.errno)
    return {
      originalCode: sqlState,
      originalMessage: error.message,
      ...mapServerError(error, sqlState),
    }
  }

  throw error
}

function mapServerError(error: BunPostgresError, sqlState: string): MappedError {
  switch (sqlState) {
    case '22001':
      return {
        kind: 'LengthMismatch',
      }
    case '22003':
      return {
        kind: 'ValueOutOfRange',
        cause: error.message,
      }
    case '22P02':
      return {
        kind: 'InvalidInputValue',
        message: error.message,
      }
    case '23505': {
      const fields = error.detail
        ?.match(/Key \(([^)]+)\)/)
        ?.at(1)
        ?.split(', ')
      return {
        kind: 'UniqueConstraintViolation',
        constraint: fields !== undefined ? { fields } : undefined,
      }
    }
    case '23502': {
      const fields = error.detail
        ?.match(/Key \(([^)]+)\)/)
        ?.at(1)
        ?.split(', ')
      return {
        kind: 'NullConstraintViolation',
        constraint: fields !== undefined ? { fields } : undefined,
      }
    }
    case '23503': {
      const fields = error.detail
        ?.match(/Key \(([^)]+)\)/)
        ?.at(1)
        ?.split(', ')

      let constraint: { fields: string[] } | { index: string } | undefined
      if (fields !== undefined) {
        constraint = { fields }
      } else if (error.constraint !== undefined) {
        constraint = { index: error.constraint }
      }

      return {
        kind: 'ForeignKeyConstraintViolation',
        constraint,
      }
    }
    case '3D000':
      return {
        kind: 'DatabaseDoesNotExist',
        db: error.message.split(' ').at(1)?.split('"').at(1),
      }
    case '28000':
      return {
        kind: 'DatabaseAccessDenied',
        db: error.message
          .split(',')
          .find((part) => part.startsWith(' database'))
          ?.split('"')
          .at(1),
      }
    case '28P01':
      return {
        kind: 'AuthenticationFailed',
        user: error.message.split(' ').pop()?.split('"').at(1),
      }
    case '40001':
      return {
        kind: 'TransactionWriteConflict',
      }
    case '42P01':
      return {
        kind: 'TableDoesNotExist',
        table: error.message.split(' ').at(1)?.split('"').at(1),
      }
    case '42703':
      return {
        kind: 'ColumnNotFound',
        column: error.message.split(' ').at(1)?.split('"').at(1),
      }
    case '42P04':
      return {
        kind: 'DatabaseAlreadyExists',
        db: error.message.split(' ').at(1)?.split('"').at(1),
      }
    case '53300':
      return {
        kind: 'TooManyConnections',
        cause: error.message,
      }
    default:
      return {
        kind: 'postgres',
        code: sqlState,
        severity: error.severity ?? 'N/A',
        message: error.message,
        detail: error.detail,
        column: undefined,
        hint: error.hint,
      }
  }
}

function isServerError(error: unknown): error is BunPostgresError {
  const errno = (error as BunPostgresError | undefined)?.errno
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as BunPostgresError).code === 'ERR_POSTGRES_SERVER_ERROR' &&
    ((typeof errno === 'string' && errno.length > 0) || typeof errno === 'number') &&
    typeof (error as BunPostgresError).message === 'string'
  )
}

function isConnectionClosedError(error: unknown): error is BunPostgresError {
  return (
    typeof error === 'object' && error !== null && (error as BunPostgresError).code === 'ERR_POSTGRES_CONNECTION_CLOSED'
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

function isSocketError(error: unknown): error is SocketError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as SocketError).code === 'string' &&
    typeof (error as SocketError).syscall === 'string' &&
    typeof (error as SocketError).errno === 'number' &&
    SOCKET_ERRORS.has((error as SocketError).code)
  )
}

function isTlsError(error: unknown): error is Error & { code?: string } {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' && TLS_ERRORS.has(code)) {
    return true
  }

  const message = (error as Error).message
  return (
    message === 'The server does not support SSL connections' ||
    message === 'There was an error establishing an SSL connection'
  )
}
