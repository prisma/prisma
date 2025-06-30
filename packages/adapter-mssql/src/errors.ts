import { Error as DriverAdapterErrorObject } from '@prisma/driver-adapter-utils'

export function convertDriverError(error: any): DriverAdapterErrorObject {
  if (!isDbError(error)) {
    throw error
  }

  // See https://learn.microsoft.com/en-us/sql/relational-databases/errors-events/database-engine-events-and-errors
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
    case 108:
    case 168:
    case 183:
    case 187:
    case 220:
    case 232:
    case 236:
    case 242:
    case 244:
    case 248:
    case 294:
    case 296:
    case 298:
    case 304:
    case 517:
    case 535:
    case 1007:
    case 1080:
    case 2386:
    case 2568:
    case 2570:
    case 2579:
    case 2742:
    case 2950:
    case 3194:
    case 3250:
    case 3606:
    case 3995:
    case 4079:
    case 4867:
    case 6244:
    case 6398:
    case 6937:
    case 6938:
    case 6960:
    case 7116:
    case 7135:
    case 7722:
    case 7810:
    case 7981:
    case 8115:
    case 8165:
    case 8351:
    case 8411:
    case 8727:
    case 8729:
    case 8968:
    case 8991:
    case 9109:
    case 9204:
    case 9526:
    case 9527:
    case 9746:
    case 9813:
    case 9835:
    case 9838:
    case 9839:
      return {
        kind: 'ValueOutOfRange',
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
