import type { DatabaseError } from '@neondatabase/serverless'
import { Error as DriverAdapterErrorObject, MappedError } from '@prisma/driver-adapter-utils'

// Node.js TLS error codes that can surface when the WebSocket/TLS handshake
// to the Neon server fails. These are identical to those handled by adapter-pg
// because both ultimately go through Node.js's TLS stack.
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

  if (isTlsError(error)) {
    return {
      kind: 'TlsConnectionError',
      reason: (error as Error).message,
    }
  }

  if (isDriverError(error)) {
    return {
      originalCode: error.code,
      originalMessage: error.message,
      ...mapDriverError(error),
    }
  }

  throw error
}

function mapDriverError(error: DatabaseError): MappedError {
  switch (error.code) {
    case '22001':
      return {
        kind: 'LengthMismatch',
        column: error.column,
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
      // PostgreSQL sets `error.column` to the violating column for NOT NULL errors.
      // The `error.detail` field contains "Failing row contains (...)", not the
      // "Key (...)" format used by unique-violation (23505), so it cannot be parsed.
      return {
        kind: 'NullConstraintViolation',
        constraint: error.column !== undefined ? { fields: [error.column] } : undefined,
      }
    }
    case '23503': {
      let constraint: { fields: string[] } | { index: string } | undefined

      if (error.column) {
        constraint = { fields: [error.column] }
      } else if (error.constraint) {
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
          .find((s) => s.startsWith(' database'))
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
    case '42703': {
      const rawColumn = error.message.match(/^column (.+) does not exist$/)?.at(1)
      return {
        kind: 'ColumnNotFound',
        column: rawColumn?.replace(/"((?:""|[^"])*)"/g, (_, id) => id.replaceAll('""', '"')),
      }
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
        code: error.code ?? 'N/A',
        severity: error.severity ?? 'N/A',
        message: error.message,
        detail: error.detail,
        column: error.column,
        hint: error.hint,
      }
  }
}

function isDriverError(error: any): error is DatabaseError {
  return (
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.severity === 'string' &&
    (typeof error.detail === 'string' || error.detail === undefined) &&
    (typeof error.column === 'string' || error.column === undefined) &&
    (typeof error.hint === 'string' || error.hint === undefined)
  )
}

type SocketError = {
  code: 'ENOTFOUND' | 'ECONNREFUSED' | 'ECONNRESET' | 'ETIMEDOUT'
  message: string
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

function isSocketError(error: any): error is SocketError {
  return typeof error.code === 'string' && SOCKET_ERRORS.has(error.code)
}

function isTlsError(error: any): error is Error & { code: string } {
  return (
    typeof error.code === 'string' &&
    TLS_ERRORS.has(error.code) &&
    typeof error.message === 'string' &&
    error.message.length > 0
  )
}
