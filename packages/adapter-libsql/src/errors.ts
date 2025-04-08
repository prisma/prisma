import { type LibsqlError } from '@libsql/client'
import { Error as DriverAdapterErrorObject } from '@prisma/driver-adapter-utils'

const SQLITE_BUSY = 5
const PRIMARY_ERROR_CODE_MASK = 0xff

export function convertDriverError(error: any): DriverAdapterErrorObject {
  if (!isDbError(error)) {
    throw error
  }

  const rawCode: number = error.rawCode ?? error.cause?.['rawCode']
  switch (rawCode) {
    case 2067:
    case 1555:
      return {
        kind: 'UniqueConstraintViolation',
        fields:
          error.message
            .split('constraint failed: ')
            .at(1)
            ?.split(', ')
            .map((field) => field.split('.').pop()!) ?? [],
      }
    case 1299:
      return {
        kind: 'NullConstraintViolation',
        fields:
          error.message
            .split('constraint failed: ')
            .at(1)
            ?.split(', ')
            .map((field) => field.split('.').pop()!) ?? [],
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
          table: error.message.split(': ').pop(),
        }
      } else if (error.message.startsWith('no such column')) {
        return {
          kind: 'ColumnNotFound',
          column: error.message.split(': ').pop(),
        }
      } else if (error.message.includes('has no column named ')) {
        return {
          kind: 'ColumnNotFound',
          column: error.message.split('has no column named ').pop(),
        }
      }

      return {
        kind: 'sqlite',
        extendedCode: rawCode,
        message: error.message,
      }
  }
}

function isDbError(error: any): error is LibsqlError {
  return (
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    (typeof error.rawCode === 'number' || error.rawCode === undefined)
  )
}
