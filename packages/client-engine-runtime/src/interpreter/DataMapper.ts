import { PrismaValueType, ResultNode } from '@prisma/client-engine-runtime'

import { assertNever } from '../utils'
import { PrismaObject, Value } from './scope'

export function applyDataMap(data: Value, structure: ResultNode): Value {
  // console.error(`data = ${JSON.stringify(data, null, 2)}`)
  // console.error(`structure = ${JSON.stringify(structure, null, 2)}`)

  if (data === null) return null

  switch (structure.type) {
    case 'object':
      if (Array.isArray(data)) {
        const rows = data as PrismaObject[]
        return rows.map((row) => mapObject(row, structure.fields))
      } else if (typeof data === 'object') {
        const row = data as PrismaObject
        return mapObject(row, structure.fields)
      }
      throw new Error(`DataMapper[1]: Expected an array or an object, got: ${typeof data}`)

    case 'value':
      return mapValue(data, structure.resultType)

    default:
      // @ts-ignore
      assertNever(structure, `Invalid data mapping type: '${structure.type}'`)
  }
}

// Recursive
function mapObject(data: PrismaObject, fields: Record<string, ResultNode>): PrismaObject {
  // console.error(`mapObject(data: ${JSON.stringify(data)}, fields: ${JSON.stringify(fields)})`)

  if (typeof data !== 'object') {
    throw new Error(`DataMapper[2]: Expected an object, but got '${typeof data}'`)
  }

  const result = {}
  for (const [name, node] of Object.entries(fields)) {
    switch (node.type) {
      case 'object':
        if (name in data) {
          const nested = data[name]
          if (Array.isArray(nested)) {
            const rows = nested as PrismaObject[]
            result[name] = rows.map((row) => mapObject(row, node.fields))
          } else if (typeof nested === 'object') {
            result[name] = mapObject(nested as PrismaObject, node.fields)
          } else {
            throw new Error(`DataMapper[3]: Expected an array or an object, but got '${typeof nested}'`)
          }
        } else {
          throw new Error(
            `DataMapper[4]: Missing data field: '${name}'; ` +
              `node: ${JSON.stringify(node)}; data: ${JSON.stringify(data)}`,
          )
        }
        break

      case 'value':
        if (node.dbName in data) {
          result[name] = mapValue(data[node.dbName], node.resultType)
        } else {
          throw new Error(
            `DataMapper[5]: Missing data field: '${node.dbName}'; ` +
              `node: ${JSON.stringify(node)}; data: ${JSON.stringify(data)}`,
          )
        }
        break

      default:
        // @ts-ignore
        assertNever(node, `Invalid data mapping node type: '${node.type}'`)
    }
  }
  return result
}

function mapValue(value: unknown, resultType: PrismaValueType): unknown {
  // console.error(`mapValue(value: ${value}, resultType: ${resultType})`)
  if (typeof resultType === 'string') {
    switch (resultType) {
      case 'any':
        return value
      case 'string':
        return typeof value === 'string' ? value : `${value}`
      case 'int':
        return typeof value === 'number' ? value : parseInt(`${value}`, 10)
      case 'bigInt':
        return typeof value === 'bigint' ? value : BigInt(`${value}`)
      case 'float':
        return typeof value === 'number' ? value : parseFloat(`${value}`)
      case 'boolean':
        return typeof value === 'boolean' ? value : value !== '0'
      case 'decimal':
        return typeof value === 'number' ? value : parseFloat(`${value}`)
      case 'date':
        return value instanceof Date ? value : new Date(`${value}`)
      case 'object':
        return typeof value === 'object' ? value : { value: value }
      case 'bytes':
        if (typeof value !== 'string') {
          throw new Error(`DataMapper[6]: Bytes data is not a string, got: ${typeof value}`)
        }
        return value
      default:
        assertNever(resultType, `Invalid resultType: ${resultType}`)
    }
  } else if (typeof resultType === 'object') {
    const values = value as unknown[]
    return values.map((v) => {
      mapValue(v, resultType.inner)
    })
  }
  throw new Error(`DataMapper[7]: Invalid resultType: ${JSON.stringify(resultType)}`)
}

/* Example data recorded by running the `queries::simple::one2m::simple::simple` QE test case:

data = [
  {
    "id": "1",
    "name": "Bob",
    "children": [
      {
        "id": "1",
        "name": "Hello!",
        "parentId": "1"
      },
      {
        "id": "2",
        "name": "World!",
        "parentId": "1"
      }
    ]
  }
]

structure = {
  "type": "object",
  "fields": {
    "id": {
      "type": "value",
      "db_name": "id",
      "result_type": "Int"
    },
    "name": {
      "type": "value",
      "db_name": "name",
      "result_type": "String"
    },
    "children": {
      "type": "object",
      "fields": {
        "id": {
          "type": "value",
          "db_name": "id",
          "result_type": "Int"
        },
        "name": {
          "type": "value",
          "db_name": "name",
          "result_type": "String"
        }
      }
    }
  }
}

*/
