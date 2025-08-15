import { DriverAdapterError, isDriverAdapterError } from '@prisma/driver-adapter-utils'

import { assertNever } from './utils'

export class UserFacingError extends Error {
  name = 'UserFacingError'
  code: string
  meta: Record<string, unknown>

  constructor(message: string, code: string, meta?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.meta = meta ?? {}
  }

  toQueryResponseErrorObject() {
    return {
      error: this.message,
      user_facing_error: {
        is_panic: false,
        message: this.message,
        meta: this.meta,
        error_code: this.code,
      },
    }
  }
}

export function rethrowAsUserFacing(error: any): never {
  if (!isDriverAdapterError(error)) {
    throw error
  }

  const code = getErrorCode(error)
  const message = renderErrorMessage(error)
  if (!code || !message) {
    throw error
  }
  throw new UserFacingError(message, code, { driverAdapterError: error })
}

export function rethrowAsUserFacingRawError(error: any): never {
  if (!isDriverAdapterError(error)) {
    throw error
  }

  throw new UserFacingError(
    `Raw query failed. Code: \`${error.cause.originalCode ?? 'N/A'}\`. Message: \`${
      error.cause.originalMessage ?? renderErrorMessage(error)
    }\``,
    'P2010',
    { driverAdapterError: error },
  )
}

function getErrorCode(err: DriverAdapterError): string | undefined {
  switch (err.cause.kind) {
    case 'AuthenticationFailed':
      return 'P1000'
    case 'DatabaseNotReachable':
      return 'P1001'
    case 'DatabaseDoesNotExist':
      return 'P1003'
    case 'SocketTimeout':
      return 'P1008'
    case 'DatabaseAlreadyExists':
      return 'P1009'
    case 'DatabaseAccessDenied':
      return 'P1010'
    case 'TlsConnectionError':
      return 'P1011'
    case 'ConnectionClosed':
      return 'P1017'
    case 'TransactionAlreadyClosed':
      return 'P1018'
    case 'LengthMismatch':
      return 'P2000'
    case 'UniqueConstraintViolation':
      return 'P2002'
    case 'ForeignKeyConstraintViolation':
      return 'P2003'
    case 'UnsupportedNativeDataType':
      return 'P2010'
    case 'NullConstraintViolation':
      return 'P2011'
    case 'ValueOutOfRange':
      return 'P2020'
    case 'TableDoesNotExist':
      return 'P2021'
    case 'ColumnNotFound':
      return 'P2022'
    case 'InvalidIsolationLevel':
    case 'InconsistentColumnData':
      return 'P2023'
    case 'MissingFullTextSearchIndex':
      return 'P2030'
    case 'TransactionWriteConflict':
      return 'P2034'
    case 'GenericJs':
      return 'P2036'
    case 'TooManyConnections':
      return 'P2037'
    case 'postgres':
    case 'sqlite':
    case 'mysql':
    case 'mssql':
      return
    default:
      assertNever(err.cause, `Unknown error: ${err.cause}`)
  }
}

function renderErrorMessage(err: DriverAdapterError): string | undefined {
  switch (err.cause.kind) {
    case 'AuthenticationFailed': {
      const user = err.cause.user ?? '(not available)'
      return `Authentication failed against the database server, the provided database credentials for \`${user}\` are not valid`
    }
    case 'DatabaseNotReachable': {
      const address = err.cause.host && err.cause.port ? `${err.cause.host}:${err.cause.port}` : err.cause.host
      return `Can't reach database server${address ? ` at ${address}` : ''}`
    }
    case 'DatabaseDoesNotExist': {
      const db = err.cause.db ?? '(not available)'
      return `Database \`${db}\` does not exist on the database server`
    }
    case 'SocketTimeout':
      return `Operation has timed out`
    case 'DatabaseAlreadyExists': {
      const db = err.cause.db ?? '(not available)'
      return `Database \`${db}\` already exists on the database server`
    }
    case 'DatabaseAccessDenied': {
      const db = err.cause.db ?? '(not available)'
      return `User was denied access on the database \`${db}\``
    }
    case 'TlsConnectionError': {
      return `Error opening a TLS connection: ${err.cause.reason}`
    }
    case 'ConnectionClosed': {
      return 'Server has closed the connection.'
    }
    case 'TransactionAlreadyClosed':
      return err.cause.cause
    case 'LengthMismatch': {
      const column = err.cause.column ?? '(not available)'
      return `The provided value for the column is too long for the column's type. Column: ${column}`
    }
    case 'UniqueConstraintViolation':
      return `Unique constraint failed on the ${renderConstraint(err.cause.constraint)}`
    case 'ForeignKeyConstraintViolation':
      return `Foreign key constraint violated on the ${renderConstraint(err.cause.constraint)}`
    case 'UnsupportedNativeDataType':
      return `Failed to deserialize column of type '${err.cause.type}'. If you're using $queryRaw and this column is explicitly marked as \`Unsupported\` in your Prisma schema, try casting this column to any supported Prisma type such as \`String\`.`
    case 'NullConstraintViolation':
      return `Null constraint violation on the ${renderConstraint(err.cause.constraint)}`
    case 'ValueOutOfRange':
      return `Value out of range for the type: ${err.cause.cause}`
    case 'TableDoesNotExist': {
      const table = err.cause.table ?? '(not available)'
      return `The table \`${table}\` does not exist in the current database.`
    }
    case 'ColumnNotFound': {
      const column = err.cause.column ?? '(not available)'
      return `The column \`${column}\` does not exist in the current database.`
    }
    case 'InvalidIsolationLevel':
      return `Error in connector: Conversion error: ${err.cause.level}`
    case 'InconsistentColumnData':
      return `Inconsistent column data: ${err.cause.cause}`
    case 'MissingFullTextSearchIndex':
      return 'Cannot find a fulltext index to use for the native search, try adding a @@fulltext([Fields...]) to your schema'
    case 'TransactionWriteConflict':
      return `Transaction failed due to a write conflict or a deadlock. Please retry your transaction`
    case 'GenericJs':
      return `Error in external connector (id ${err.cause.id})`
    case 'TooManyConnections':
      return `Too many database connections opened: ${err.cause.cause}`
    case 'sqlite':
    case 'postgres':
    case 'mysql':
    case 'mssql':
      return
    default:
      assertNever(err.cause, `Unknown error: ${err.cause}`)
  }
}

function renderConstraint(constraint?: { fields: string[] } | { index: string } | { foreignKey: {} }): string {
  if (constraint && 'fields' in constraint) {
    return `fields: (${constraint.fields.map((field) => `\`${field}\``).join(', ')})`
  } else if (constraint && 'index' in constraint) {
    return `constraint: \`${constraint.index}\``
  } else if (constraint && 'foreignKey' in constraint) {
    return `foreign key`
  }
  return '(not available)'
}
