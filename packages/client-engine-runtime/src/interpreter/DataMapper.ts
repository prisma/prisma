import Decimal from 'decimal.js'

import { PrismaValueType, ResultNode } from '../QueryPlan'
import { assertNever, safeJsonStringify } from '../utils'
import { PrismaObject, Value } from './scope'

export class DataMapperError extends Error {
  name = 'DataMapperError'
}

export function applyDataMap(data: Value, structure: ResultNode): Value {
  switch (structure.type) {
    case 'Object':
      return mapArrayOrObject(data, structure.fields)

    case 'Value':
      return mapValue(data, '<result>', structure.resultType)

    default:
      assertNever(structure, `Invalid data mapping type: '${(structure as ResultNode).type}'`)
  }
}

function mapArrayOrObject(data: Value, fields: Record<string, ResultNode>): PrismaObject | PrismaObject[] | null {
  if (data === null) return null

  if (Array.isArray(data)) {
    const rows = data as PrismaObject[]
    return rows.map((row) => mapObject(row, fields))
  }

  if (typeof data === 'object') {
    const row = data as PrismaObject
    return mapObject(row, fields)
  }

  if (typeof data === 'string') {
    let decodedData: Value
    try {
      decodedData = JSON.parse(data)
    } catch (error) {
      throw new DataMapperError(`Expected an array or object, got a string that is not valid JSON`, {
        cause: error,
      })
    }
    return mapArrayOrObject(decodedData, fields)
  }

  throw new DataMapperError(`Expected an array or an object, got: ${typeof data}`)
}

// Recursive
function mapObject(data: PrismaObject, fields: Record<string, ResultNode>): PrismaObject {
  if (typeof data !== 'object') {
    throw new DataMapperError(`Expected an object, but got '${typeof data}'`)
  }

  const result = {}
  for (const [name, node] of Object.entries(fields)) {
    switch (node.type) {
      case 'Object': {
        if (!node.flattened && !Object.hasOwn(data, name)) {
          throw new DataMapperError(
            `Missing data field (Object): '${name}'; ` + `node: ${JSON.stringify(node)}; data: ${JSON.stringify(data)}`,
          )
        }

        const target = node.flattened ? data : data[name]
        result[name] = mapArrayOrObject(target, node.fields)
        break
      }
      case 'Value':
        {
          const dbName = node.dbName
          if (Object.hasOwn(data, dbName)) {
            result[name] = mapValue(data[dbName], dbName, node.resultType)
          } else {
            throw new DataMapperError(
              `Missing data field (Value): '${dbName}'; ` +
                `node: ${JSON.stringify(node)}; data: ${JSON.stringify(data)}`,
            )
          }
        }
        break

      default:
        assertNever(node, `DataMapper: Invalid data mapping node type: '${(node as ResultNode).type}'`)
    }
  }
  return result
}

function mapValue(value: unknown, columnName: string, resultType: PrismaValueType): unknown {
  if (value === null) return null

  switch (resultType.type) {
    case 'Any':
      return value

    case 'String': {
      if (typeof value !== 'string') {
        throw new DataMapperError(`Expected a string in column '${columnName}', got ${typeof value}: ${value}`)
      }
      return value
    }

    case 'Int': {
      switch (typeof value) {
        case 'number': {
          if (Number.isInteger(value)) {
            return value
          }
          throw new DataMapperError(`Expected an integer in column '${columnName}', got float: ${value}`)
        }

        case 'bigint': {
          const numberValue = Number(value)
          if (Number.isInteger(numberValue)) {
            return numberValue
          }
          throw new DataMapperError(
            `Big integer value in column '${columnName}' is too large to represent as a JavaScript number, got: ${value}`,
          )
        }

        case 'string': {
          const numberValue = Number(value)
          if (Number.isInteger(numberValue)) {
            return numberValue
          }
          try {
            BigInt(value)
          } catch {
            throw new DataMapperError(`Expected an integer in column '${columnName}', got string: ${value}`)
          }
          throw new DataMapperError(
            `Integer value in column '${columnName}' is too large to represent as a JavaScript number without loss of precision, got: ${value}. Consider using BigInt type.`,
          )
        }

        default:
          throw new DataMapperError(`Expected an integer in column '${columnName}', got ${typeof value}: ${value}`)
      }
    }

    case 'BigInt': {
      if (typeof value !== 'bigint' && typeof value !== 'number' && typeof value !== 'string') {
        throw new DataMapperError(`Expected a bigint in column '${columnName}', got ${typeof value}: ${value}`)
      }
      return { $type: 'BigInt', value }
    }

    case 'Float': {
      if (typeof value === 'number') return value
      if (typeof value === 'string') {
        const parsedValue = Number(value)
        if (Number.isNaN(parsedValue) && !/^[-+]?nan$/.test(value.toLowerCase())) {
          throw new DataMapperError(`Expected a float in column '${columnName}', got string: ${value}`)
        }
        return parsedValue
      }
      throw new DataMapperError(`Expected a float in column '${columnName}', got ${typeof value}: ${value}`)
    }

    case 'Boolean': {
      if (typeof value === 'boolean') return value
      if (typeof value === 'number') return value === 1
      if (typeof value === 'bigint') return value === 1n
      if (typeof value === 'string') {
        if (value === 'true' || value === 'TRUE' || value === '1') {
          return true
        } else if (value === 'false' || value === 'FALSE' || value === '0') {
          return false
        } else {
          throw new DataMapperError(`Expected a boolean in column '${columnName}', got ${typeof value}: ${value}`)
        }
      }
      throw new DataMapperError(`Expected a boolean in column '${columnName}', got ${typeof value}: ${value}`)
    }

    case 'Decimal':
      if (typeof value !== 'number' && typeof value !== 'string' && !Decimal.isDecimal(value)) {
        throw new DataMapperError(`Expected a decimal in column '${columnName}', got ${typeof value}: ${value}`)
      }
      return { $type: 'Decimal', value }

    case 'Date': {
      if (typeof value === 'string') {
        return { $type: 'DateTime', value: ensureTimezoneInIsoString(value) }
      }
      if (typeof value === 'number' || value instanceof Date) {
        return { $type: 'DateTime', value }
      }
      throw new DataMapperError(`Expected a date in column '${columnName}', got ${typeof value}: ${value}`)
    }

    case 'Array': {
      const values = value as unknown[]
      return values.map((v, i) => mapValue(v, `${columnName}[${i}]`, resultType.inner))
    }

    case 'Object': {
      const jsonValue = typeof value === 'string' ? value : safeJsonStringify(value)
      return { $type: 'Json', value: jsonValue }
    }

    case 'Bytes': {
      if (typeof value === 'string') {
        return { $type: 'Bytes', value }
      }
      if (Array.isArray(value) || value instanceof Uint8Array) {
        return { $type: 'Bytes', value: Buffer.from(value).toString('base64') }
      }
      throw new DataMapperError(`Expected a byte array in column '${columnName}', got ${typeof value}: ${value}`)
    }

    default:
      assertNever(resultType, `DataMapper: Unknown result type: ${(resultType as PrismaValueType).type}`)
  }
}

const TIMEZONE_PATTERN = /Z$|[+-]\d{2}:?\d{2}$/

/**
 * Appends a UTC timezone to a datetime string if there's no timezone specified,
 * to prevent it from being interpreted as local time. Normally this is taken
 * care of by the driver adapters, except when using `relationLoadStrategy: join`
 * and the data to convert is inside a JSON string containing nested records.
 */
function ensureTimezoneInIsoString(dt: string): string {
  return TIMEZONE_PATTERN.test(dt) ? dt : `${dt}Z`
}
