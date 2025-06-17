import { Error as DriverAdapterErrorObject } from '@prisma/driver-adapter-utils'

export function convertDriverError(error: any): DriverAdapterErrorObject {
  if (!isDbError(error)) {
    throw error
  }

  switch (error.number) {
    case 3902:
    case 3903:
    case 3971:
      return {
        kind: 'TransactionAlreadyClosed',
        cause: error.message,
      }
    case 8169:
      return {
        kind: 'InconsistentColumnData',
        cause: error.message,
      }
    case 18456: {
      const user = error.message.split("'").at(1)
      return {
        kind: 'AuthenticationFailed',
        user,
      }
    }
    case 4060: {
      const db = error.message.split('"').at(1)
      return {
        kind: 'DatabaseDoesNotExist',
        db,
      }
    }
    case 515: {
      const field = error.message.split(' ').at(7)?.split("'").at(1)
      return {
        kind: 'NullConstraintViolation',
        constraint: field ? { fields: [field] } : undefined,
      }
    }
    case 1801: {
      const db = error.message.split("'").at(1)
      return {
        kind: 'DatabaseAlreadyExists',
        db,
      }
    }
    case 2627: {
      const index = error.message.split('. ').at(1)?.split(' ').pop()?.split("'").at(1)
      return {
        kind: 'UniqueConstraintViolation',
        constraint: index ? { index } : undefined,
      }
    }
    case 547: {
      const index = error.message.split('.').at(0)?.split(' ').pop()?.split('"').at(1)
      return {
        kind: 'ForeignKeyConstraintViolation',
        constraint: index ? { index } : undefined,
      }
    }
    case 1505: {
      const index = error.message.split("'").at(3)
      return {
        kind: 'UniqueConstraintViolation',
        constraint: index ? { index } : undefined,
      }
    }
    case 2601: {
      const index = error.message.split(' ').at(11)?.split("'").at(1)
      return {
        kind: 'UniqueConstraintViolation',
        constraint: index ? { index } : undefined,
      }
    }
    case 2628: {
      const column = error.message.split("'").at(3)
      return {
        kind: 'LengthMismatch',
        column,
      }
    }
    case 208: {
      const table = error.message.split(' ').at(3)?.split("'").at(1)
      return {
        kind: 'TableDoesNotExist',
        table,
      }
    }
    case 207: {
      const column = error.message.split(' ').at(3)?.split("'").at(1)
      return {
        kind: 'ColumnNotFound',
        column,
      }
    }
    case 1205:
      return {
        kind: 'TransactionWriteConflict',
      }
    case 5828:
      return {
        kind: 'TooManyConnections',
        cause: error.message,
      }
    default:
      return {
        kind: 'mssql',
        code: error.number,
        message: error.message,
      }
  }
}

function isDbError(error: any): error is { message: string; code: string; number: number } {
  return typeof error.message === 'string' && typeof error.code === 'string' && typeof error.number === 'number'
}
