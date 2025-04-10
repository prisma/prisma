import { Error as DriverAdapterErrorObject } from '@prisma/driver-adapter-utils'
import type { DatabaseError } from 'pg'

export function convertDriverError(error: any): DriverAdapterErrorObject {
  if (!isDbError(error)) {
    throw error
  }

  switch (error.code) {
    case '22001':
      return {
        kind: 'LengthMismatch',
        column: error.column,
      }
    case '23505':
      return {
        kind: 'UniqueConstraintViolation',
        fields:
          error.detail
            ?.match(/Key \(([^)]+)\)/)
            ?.at(1)
            ?.split(', ') ?? [],
      }
    case '23502':
      return {
        kind: 'NullConstraintViolation',
        fields:
          error.detail
            ?.match(/Key \(([^)]+)\)/)
            ?.at(1)
            ?.split(', ') ?? [],
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
        db: error.message.split(' ').at(5)?.split('"').at(1),
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
    case '42703':
      return {
        kind: 'ColumnNotFound',
        column: error.message.split(' ').at(1)?.split('"').at(1),
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

function isDbError(error: any): error is DatabaseError {
  return (
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.severity === 'string' &&
    (typeof error.detail === 'string' || error.detail === undefined) &&
    (typeof error.column === 'string' || error.column === undefined) &&
    (typeof error.hint === 'string' || error.hint === undefined)
  )
}
