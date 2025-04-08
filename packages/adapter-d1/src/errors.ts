import { Error as DriverAdapterErrorObject } from '@prisma/driver-adapter-utils'

// When we receive the result, we only get the error message, not the error code.
// Example:
// "name":"Error","message":"D1_ERROR: UNIQUE constraint failed: User.email"
// So we try to match some errors and use the generic error code as a fallback.
// https://www.sqlite.org/rescode.html
export function convertDriverError(error: any): DriverAdapterErrorObject {
  if (!isDbError(error)) {
    throw error
  }
  let stripped = error.message.split('D1_ERROR: ').at(1) ?? error.message
  stripped = stripped.split('SqliteError: ').at(1) ?? stripped

  if (stripped.startsWith('UNIQUE constraint failed') || stripped.startsWith('PRIMARY KEY constraint failed')) {
    return {
      kind: 'UniqueConstraintViolation',
      fields:
        stripped
          .split(': ')
          .at(1)
          ?.split(', ')
          .map((field) => field.split('.').pop()!) ?? [],
    }
  } else if (stripped.startsWith('NOT NULL constraint failed')) {
    return {
      kind: 'NullConstraintViolation',
      fields:
        stripped
          .split(': ')
          .at(1)
          ?.split(', ')
          .map((field) => field.split('.').pop()!) ?? [],
    }
  } else if (stripped.startsWith('FOREIGN KEY constraint failed') || stripped.startsWith('CHECK constraint failed')) {
    return {
      kind: 'ForeignKeyConstraintViolation',
      constraint: { foreignKey: {} },
    }
  } else if (stripped.startsWith('no such table')) {
    return {
      kind: 'TableDoesNotExist',
      table: stripped.split(': ').pop(),
    }
  } else if (stripped.startsWith('no such column')) {
    return {
      kind: 'ColumnNotFound',
      column: stripped.split(': ').pop(),
    }
  } else if (stripped.includes('has no column named ')) {
    return {
      kind: 'ColumnNotFound',
      column: stripped.split('has no column named ').pop(),
    }
  }

  return {
    kind: 'sqlite',
    extendedCode: error['code'] ?? error['cause']?.['code'] ?? 1,
    message: error.message,
  }
}

function isDbError(error: any): error is { message: string } {
  return typeof error.message === 'string'
}
