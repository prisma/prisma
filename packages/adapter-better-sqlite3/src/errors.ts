import { Error as DriverAdapterErrorObject } from '@prisma/driver-adapter-utils'

export function convertDriverError(error: any): DriverAdapterErrorObject {
  if (typeof error.code !== 'string' || typeof error.message !== 'string') {
    throw error
  }

  switch (error.code) {
    case 'SQLITE_BUSY':
      return {
        kind: 'SocketTimeout',
      }
    case 'SQLITE_CONSTRAINT_UNIQUE':
    case 'SQLITE_CONSTRAINT_PRIMARYKEY':
      return {
        kind: 'UniqueConstraintViolation',
        fields:
          error.message
            .split('constraint failed: ')
            .at(1)
            ?.split(', ')
            .map((field) => field.split('.').pop()!) ?? [],
      }
    case 'SQLITE_CONSTRAINT_NOTNULL':
      return {
        kind: 'NullConstraintViolation',
        fields:
          error.message
            .split('constraint failed: ')
            .at(1)
            ?.split(', ')
            .map((field) => field.split('.').pop()!) ?? [],
      }
    case 'SQLITE_CONSTRAINT_FOREIGNKEY':
    case 'SQLITE_CONSTRAINT_TRIGGER':
      return {
        kind: 'ForeignKeyConstraintViolation',
        constraint: { foreignKey: {} },
      }
    default:
      if (error.message.startsWith('no such table')) {
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

      throw error
  }
}
