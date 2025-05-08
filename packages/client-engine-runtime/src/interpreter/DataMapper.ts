import Decimal from 'decimal.js'

import { PrismaValueType, ResultNode } from '../QueryPlan'
import { assertNever } from '../utils'
import { PrismaObject, Value } from './scope'

export function applyDataMap(data: Value, structure: ResultNode): Value {
  switch (structure.type) {
    case 'Object':
      return mapArrayOrObject(data, structure.fields)

    case 'Value':
      return mapValue(data, structure.resultType)

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

  throw new Error(`DataMapper: Expected an array or an object, got: ${typeof data}`)
}

// Recursive
function mapObject(data: PrismaObject, fields: Record<string, ResultNode>): PrismaObject {
  if (typeof data !== 'object') {
    throw new Error(`DataMapper: Expected an object, but got '${typeof data}'`)
  }

  const result = {}
  for (const [name, node] of Object.entries(fields)) {
    switch (node.type) {
      case 'Object':
        if (Object.hasOwn(data, name)) {
          result[name] = mapArrayOrObject(data[name], node.fields)
        } else {
          throw new Error(
            `DataMapper: Missing data field (Object): '${name}'; ` +
              `node: ${JSON.stringify(node)}; data: ${JSON.stringify(data)}`,
          )
        }
        break

      case 'Value':
        {
          const dbName = node.dbName
          if (Object.hasOwn(data, dbName)) {
            result[name] = mapValue(data[dbName], node.resultType)
          } else {
            throw new Error(
              `DataMapper: Missing data field (Value): '${dbName}'; ` +
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

function mapValue(value: unknown, resultType: PrismaValueType): unknown {
  if (value === null) return null

  switch (resultType.type) {
    case 'Any':
      return value
    case 'String':
      return typeof value === 'string' ? value : `${value}`
    case 'Int':
      return typeof value === 'number' ? value : parseInt(`${value}`, 10)
    case 'BigInt':
      return typeof value === 'bigint' ? value : BigInt(`${value}`)
    case 'Float':
      return typeof value === 'number' ? value : parseFloat(`${value}`)
    case 'Boolean':
      return typeof value === 'boolean' ? value : value !== '0'
    case 'Decimal':
      return typeof value === 'number' ? new Decimal(value) : new Decimal(`${value}`)
    case 'Date':
      return value instanceof Date ? value : new Date(`${value}`)
    case 'Array': {
      const values = value as unknown[]
      return values.map((v) => mapValue(v, resultType.inner))
    }
    case 'Object':
      return typeof value === 'string' ? value : JSON.stringify(value)
    case 'Bytes': {
      if (!Array.isArray(value)) {
        throw new Error(`DataMapper: Bytes data is invalid, got: ${typeof value}`)
      }
      const { buffer, byteOffset, byteLength } = Buffer.from(value)
      return new Uint8Array(buffer, byteOffset, byteLength)
    }
    default:
      assertNever(resultType, `DataMapper: Unknown result type: ${(resultType as PrismaValueType).type}`)
  }
}
