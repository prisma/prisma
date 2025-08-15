import Decimal from 'decimal.js'

import { PrismaValueType, ResultNode } from '../query-plan'
import { assertNever, safeJsonStringify } from '../utils'
import { PrismaObject, Value } from './scope'

export class DataMapperError extends Error {
  name = 'DataMapperError'
}

export function applyDataMap(data: Value, structure: ResultNode, enums: Record<string, Record<string, string>>): Value {
  switch (structure.type) {
    case 'AffectedRows':
      if (typeof data !== 'number') {
        throw new DataMapperError(`Expected an affected rows count, got: ${typeof data} (${data})`)
      }
      return { count: data }

    case 'Object':
      return mapArrayOrObject(data, structure.fields, enums, structure.skipNulls)

    case 'Value':
      return mapValue(data, '<result>', structure.resultType, enums)

    default:
      assertNever(structure, `Invalid data mapping type: '${(structure as ResultNode).type}'`)
  }
}

function mapArrayOrObject(
  data: Value,
  fields: Record<string, ResultNode>,
  enums: Record<string, Record<string, string>>,
  skipNulls?: boolean,
): PrismaObject | PrismaObject[] | null {
  if (data === null) return null

  if (Array.isArray(data)) {
    let rows = data as PrismaObject[]
    if (skipNulls) {
      rows = rows.filter((row) => row !== null)
    }
    return rows.map((row) => mapObject(row, fields, enums))
  }

  if (typeof data === 'object') {
    const row = data as PrismaObject
    return mapObject(row, fields, enums)
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
    return mapArrayOrObject(decodedData, fields, enums, skipNulls)
  }

  throw new DataMapperError(`Expected an array or an object, got: ${typeof data}`)
}

// Recursive
function mapObject(
  data: PrismaObject,
  fields: Record<string, ResultNode>,
  enums: Record<string, Record<string, string>>,
): PrismaObject {
  if (typeof data !== 'object') {
    throw new DataMapperError(`Expected an object, but got '${typeof data}'`)
  }

  const result = {}
  for (const [name, node] of Object.entries(fields)) {
    switch (node.type) {
      case 'AffectedRows': {
        throw new DataMapperError(`Unexpected 'AffectedRows' node in data mapping for field '${name}'`)
      }

      case 'Object': {
        if (node.serializedName !== null && !Object.hasOwn(data, node.serializedName)) {
          throw new DataMapperError(
            `Missing data field (Object): '${name}'; ` + `node: ${JSON.stringify(node)}; data: ${JSON.stringify(data)}`,
          )
        }

        const target = node.serializedName !== null ? data[node.serializedName] : data
        result[name] = mapArrayOrObject(target, node.fields, enums, node.skipNulls)
        break
      }

      case 'Value':
        {
          const dbName = node.dbName
          if (Object.hasOwn(data, dbName)) {
            result[name] = mapValue(data[dbName], dbName, node.resultType, enums)
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

function mapValue(
  value: unknown,
  columnName: string,
  resultType: PrismaValueType,
  enums: Record<string, Record<string, string>>,
): unknown {
  if (value === null) {
    return resultType.type === 'Array' ? [] : null
  }

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
          return Math.trunc(value)
        }

        case 'string': {
          const numberValue = Math.trunc(Number(value))
          if (Number.isNaN(numberValue) || !Number.isFinite(numberValue)) {
            throw new DataMapperError(`Expected an integer in column '${columnName}', got string: ${value}`)
          }
          if (!Number.isSafeInteger(numberValue)) {
            throw new DataMapperError(
              `Integer value in column '${columnName}' is too large to represent as a JavaScript number without loss of precision, got: ${value}. Consider using BigInt type.`,
            )
          }
          return numberValue
        }

        default:
          throw new DataMapperError(`Expected an integer in column '${columnName}', got ${typeof value}: ${value}`)
      }
    }

    case 'BigInt': {
      if (typeof value !== 'number' && typeof value !== 'string') {
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
      if (typeof value === 'string') {
        if (value === 'true' || value === 'TRUE' || value === '1') {
          return true
        } else if (value === 'false' || value === 'FALSE' || value === '0') {
          return false
        } else {
          throw new DataMapperError(`Expected a boolean in column '${columnName}', got ${typeof value}: ${value}`)
        }
      }
      if (value instanceof Uint8Array) {
        for (const byte of value) {
          if (byte !== 0) return true
        }
        return false
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

    case 'Time': {
      if (typeof value === 'string') {
        return { $type: 'DateTime', value: `1970-01-01T${ensureTimezoneInIsoString(value)}` }
      }

      throw new DataMapperError(`Expected a time in column '${columnName}', got ${typeof value}: ${value}`)
    }

    case 'Array': {
      const values = value as unknown[]
      return values.map((v, i) => mapValue(v, `${columnName}[${i}]`, resultType.inner, enums))
    }

    case 'Object': {
      return { $type: 'Json', value: safeJsonStringify(value) }
    }

    case 'Json': {
      // The value received here should normally be a string, but we cannot guarantee that,
      // because of SQLite databases like D1, which can return JSON scalars directly. We therefore
      // convert the value we receive to a string.
      return { $type: 'Json', value: `${value}` }
    }

    case 'Bytes': {
      if (typeof value === 'string' && value.startsWith('\\x')) {
        // Postgres bytea hex format. We have to handle it here and not only in
        // driver adapters in order to support `Bytes` fields in nested records
        // when using `relationLoadStrategy: join`.
        return { $type: 'Bytes', value: Buffer.from(value.slice(2), 'hex').toString('base64') }
      }
      if (Array.isArray(value)) {
        return { $type: 'Bytes', value: Buffer.from(value).toString('base64') }
      }
      if (value instanceof Uint8Array) {
        return { $type: 'Bytes', value: Buffer.from(value).toString('base64') }
      }
      throw new DataMapperError(`Expected a byte array in column '${columnName}', got ${typeof value}: ${value}`)
    }

    case 'Enum': {
      const enumDef = enums[resultType.inner]
      if (enumDef === undefined) {
        throw new DataMapperError(`Unknown enum '${resultType.inner}'`)
      }
      const enumValue = enumDef[`${value}`]
      if (enumValue === undefined) {
        throw new DataMapperError(`Value '${value}' not found in enum '${resultType.inner}'`)
      }
      return enumValue
    }

    default:
      assertNever(resultType, `DataMapper: Unknown result type: ${(resultType as PrismaValueType).type}`)
  }
}

// The negative lookahead is to avoid a false positive on a date string like "2023-10-01".
const TIMEZONE_PATTERN = /Z$|(?<!\d{4}-\d{2})[+-]\d{2}(:?\d{2})?$/

/**
 * Appends a UTC timezone to a datetime string if there's no timezone specified,
 * to prevent it from being interpreted as local time. Normally this is taken
 * care of by the driver adapters, except when using `relationLoadStrategy: join`
 * and the data to convert is inside a JSON string containing nested records.
 */
function ensureTimezoneInIsoString(dt: string): string {
  const results = TIMEZONE_PATTERN.exec(dt)
  if (results === null) {
    return `${dt}Z`
  } else if (results[0] !== 'Z' && results[1] === undefined) {
    // If the timezone is specified as +HH or -HH (without minutes), we need to append ":00"
    // to it to satisfy the JavaScript Date constructor.
    return `${dt}:00`
  } else {
    return dt
  }
}
