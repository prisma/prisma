import { Error as DriverAdapterErrorObject, MappedError } from '@prisma/driver-adapter-utils'

const SOCKET_ERRORS = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'])

const TLS_ERRORS = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
  'CERT_UNTRUSTED',
  'HOSTNAME_MISMATCH',
])

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

  if (isSurrealDbError(error)) {
    return {
      originalCode: error.code ?? 'UNKNOWN',
      originalMessage: error.message,
      ...mapSurrealDbError(error),
    }
  }

  if (error instanceof Error) {
    return {
      kind: 'surrealdb',
      code: 'UNKNOWN',
      message: error.message,
    }
  }

  throw error
}

type SurrealDbError = Error & {
  code?: string
  message: string
}

function mapSurrealDbError(error: SurrealDbError): MappedError {
  const message = error.message.toLowerCase()

  // Order matters: check more specific patterns before generic ones.
  // "table ... not found" must be checked before "database" since
  // "not found in the database" contains both words.

  if (message.includes('not found') && message.includes('field')) {
    return {
      kind: 'ColumnNotFound',
      column: extractName(error.message),
    }
  }

  if (message.includes('not found') && message.includes('table')) {
    return {
      kind: 'TableDoesNotExist',
      table: extractName(error.message),
    }
  }

  if (message.includes('already exists') && message.includes('database')) {
    return {
      kind: 'DatabaseAlreadyExists',
      db: extractName(error.message),
    }
  }

  if (message.includes('not found') && message.includes('database')) {
    return {
      kind: 'DatabaseDoesNotExist',
      db: extractName(error.message),
    }
  }

  if (message.includes('unique') || message.includes('duplicate') || message.includes('already exists')) {
    return {
      kind: 'UniqueConstraintViolation',
      constraint: undefined,
    }
  }

  if (message.includes('authentication') || message.includes('credentials') || message.includes('signin')) {
    return {
      kind: 'AuthenticationFailed',
      user: undefined,
    }
  }

  if (message.includes('connection') && (message.includes('refused') || message.includes('closed'))) {
    return {
      kind: 'ConnectionClosed',
    }
  }

  if (message.includes('null') && (message.includes('required') || message.includes('not null'))) {
    return {
      kind: 'NullConstraintViolation',
      constraint: undefined,
    }
  }

  return {
    kind: 'surrealdb',
    code: error.code ?? 'UNKNOWN',
    message: error.message,
  }
}

function extractName(message: string): string | undefined {
  // Try to extract a quoted name like 'name' or "name"
  const match = message.match(/['"]([^'"]+)['"]/)
  return match?.at(1)
}

function isSurrealDbError(error: unknown): error is SurrealDbError {
  return error instanceof Error && typeof (error as SurrealDbError).message === 'string'
}

type SocketError = Error & {
  code: string
  syscall: string
  errno: number
  address?: string
  port?: number
  hostname?: string
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
    default:
      return {
        kind: 'DatabaseNotReachable',
        host: error.address ?? error.hostname,
        port: error.port,
      }
  }
}

function isSocketError(error: unknown): error is SocketError {
  const err = error as Record<string, unknown>
  return (
    typeof err?.code === 'string' &&
    typeof err?.syscall === 'string' &&
    typeof err?.errno === 'number' &&
    SOCKET_ERRORS.has(err.code as string)
  )
}

function isTlsError(error: unknown): error is Error & { code?: string } {
  const err = error as Record<string, unknown>
  if (typeof err?.code === 'string') {
    return TLS_ERRORS.has(err.code as string)
  }
  return false
}
