import { DriverAdapterError } from '@prisma/driver-adapter-utils'
import { assertNever } from '@prisma/internals'

export function getErrorCode(err: DriverAdapterError): string | undefined {
  switch (err.cause.kind) {
    case 'AuthenticationFailed':
      return 'P1000'
    case 'DatabaseDoesNotExist':
      return 'P1003'
    case 'SocketTimeout':
      return 'P1008'
    case 'DatabaseAlreadyExists':
      return 'P1009'
    case 'DatabaseAccessDenied':
      return 'P1010'
    case 'LengthMismatch':
      return 'P2000'
    case 'UniqueConstraintViolation':
      return 'P2002'
    case 'ForeignKeyConstraintViolation':
      return 'P2003'
    case 'NullConstraintViolation':
      return 'P2011'
    case 'TableDoesNotExist':
      return 'P2021'
    case 'ColumnNotFound':
      return 'P2022'
    case 'UnsupportedNativeDataType':
    case 'InvalidIsolationLevel':
      return 'P2023'
    case 'TransactionWriteConflict':
      return 'P2034'
    case 'GenericJs':
      return 'P2036'
    case 'TooManyConnections':
      return 'P2037'
    case 'postgres':
    case 'sqlite':
    case 'mysql':
      return
    default:
      assertNever(err.cause, 'Unexpected error')
  }
}

export function renderError(err: DriverAdapterError): string | undefined {
  switch (err.cause.kind) {
    case 'AuthenticationFailed': {
      const user = err.cause.user ?? '(not available)'
      return `Authentication failed against the database server, the provided database credentials for \`${user}\` are not valid`
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
    case 'LengthMismatch': {
      const column = err.cause.column ?? '(not available)'
      return `The provided value for the column is too long for the column's type. Column: ${column}`
    }
    case 'UniqueConstraintViolation':
      return `Unique constraint failed on the ${renderConstraint({ fields: err.cause.fields })}`
    case 'ForeignKeyConstraintViolation':
      return `Foreign key constraint violated on the ${renderConstraint(err.cause.constraint)}`
    case 'NullConstraintViolation':
      return `Null constraint violation on the ${renderConstraint({ fields: err.cause.fields })}`
    case 'TableDoesNotExist': {
      const table = err.cause.table ?? '(not available)'
      return `The table \`${table}\` does not exist in the current database.`
    }
    case 'ColumnNotFound': {
      const column = err.cause.column ?? '(not available)'
      return `The column \`${column}\` does not exist in the current database.`
    }
    case 'UnsupportedNativeDataType':
      return `Column type '${err.cause.type}' could not be deserialized from the database.`
    case 'InvalidIsolationLevel':
      return `Invalid isolation level \`${err.cause.level}\``
    case 'TransactionWriteConflict':
      return `Transaction failed due to a write conflict or a deadlock. Please retry your transaction`
    case 'GenericJs':
      return `Error in external connector (id ${err.cause.id})`
    case 'TooManyConnections':
      return `Too many database connections opened: ${err.cause.cause}`
    case 'sqlite':
    case 'postgres':
    case 'mysql':
      return
    default:
      assertNever(err.cause, 'Unexpected error')
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
