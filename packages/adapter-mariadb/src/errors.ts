import { Error as DriverAdapterErrorObject } from '@prisma/driver-adapter-utils'

export function convertDriverError(error: unknown): DriverAdapterErrorObject {
  if (!isDbError(error)) {
    throw error
  }

  switch (error.errno) {
    case 1062: {
      const index = error.sqlMessage?.split(' ').pop()?.split("'").at(1)?.split('.').pop()
      return {
        kind: 'UniqueConstraintViolation',
        constraint: index !== undefined ? { index } : undefined,
      }
    }

    case 1451:
    case 1452: {
      const field = error.sqlMessage?.split(' ').at(17)?.split('`').at(1)
      return {
        kind: 'ForeignKeyConstraintViolation',
        constraint: field !== undefined ? { fields: [field] } : undefined,
      }
    }

    case 1263: {
      const index = error.sqlMessage?.split(' ').pop()?.split("'").at(1)
      return {
        kind: 'NullConstraintViolation',
        constraint: index !== undefined ? { index } : undefined,
      }
    }

    case 1264:
      return {
        kind: 'ValueOutOfRange',
        cause: error.sqlMessage ?? 'N/A',
      }

    case 1364:
    case 1048: {
      const field = error.sqlMessage?.split(' ').at(1)?.split("'").at(1)
      return {
        kind: 'NullConstraintViolation',
        constraint: field !== undefined ? { fields: [field] } : undefined,
      }
    }

    case 1049: {
      const db = error.sqlMessage?.split(' ').pop()?.split("'").at(1)
      return {
        kind: 'DatabaseDoesNotExist',
        db,
      }
    }

    case 1007: {
      const db = error.sqlMessage?.split(' ').at(3)?.split("'").at(1)
      return {
        kind: 'DatabaseAlreadyExists',
        db,
      }
    }

    case 1044: {
      const db = error.sqlMessage?.split(' ').pop()?.split("'").at(1)
      return {
        kind: 'DatabaseAccessDenied',
        db,
      }
    }

    case 1045: {
      const user = error.sqlMessage?.split(' ').at(4)?.split('@').at(0)?.split("'").at(1)
      return {
        kind: 'AuthenticationFailed',
        user,
      }
    }

    case 1146: {
      const table = error.sqlMessage?.split(' ').at(1)?.split("'").at(1)?.split('.').pop()
      return {
        kind: 'TableDoesNotExist',
        table,
      }
    }

    case 1054: {
      const column = error.sqlMessage?.split(' ').at(2)?.split("'").at(1)
      return {
        kind: 'ColumnNotFound',
        column,
      }
    }

    case 1406: {
      const column = error.sqlMessage
        ?.split(' ')
        .flatMap((part) => part.split("'"))
        .at(6)
      return {
        kind: 'LengthMismatch',
        column,
      }
    }

    case 1191:
      return {
        kind: 'MissingFullTextSearchIndex',
      }

    case 1213:
      return {
        kind: 'TransactionWriteConflict',
      }

    case 1040:
    case 1203:
      return {
        kind: 'TooManyConnections',
        cause: error.sqlMessage ?? 'N/A',
      }

    default:
      return {
        kind: 'mysql',
        code: error.errno,
        message: error.sqlMessage ?? 'N/A',
        state: error.sqlState ?? 'N/A',
      }
  }
}

function isDbError(error: any): error is { errno: number; sqlMessage: string | null; sqlState: string | null } {
  return (
    typeof error.errno === 'number' &&
    (typeof error.sqlMessage === 'string' || error.sqlMessage === null) &&
    (typeof error.sqlState === 'string' || error.sqlState === null)
  )
}
