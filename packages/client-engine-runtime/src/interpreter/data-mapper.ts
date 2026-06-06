import { Decimal } from '@prisma/client-runtime-utils'
import type { SqlResultSet } from '@prisma/driver-adapter-utils'

import { FieldScalarType, FieldScalarTypeName, FieldType, ResultNode } from '../query-plan'
import { UserFacingError } from '../user-facing-error'
import { assertNever, safeJsonStringify } from '../utils'
import { PrismaObject, Value } from './scope'

export type QueryResultFormat = 'jsonProtocol' | 'js'

export class DataMapperError extends UserFacingError {
  name = 'DataMapperError'

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 'P2023', options)
  }
}

// Optimization: Cache field entries to avoid repeated Object.entries() allocations per row
const fieldEntriesCache = new WeakMap<Record<string, ResultNode>, [string, ResultNode][]>()
const columnIndexesCache = new WeakMap<string[], Record<string, number>>()
const resultSetFieldMappingsCache = new WeakMap<
  Record<string, ResultNode>,
  WeakMap<string[], ResultSetFieldMapping[]>
>()
const resultSetFieldMappingsByShapeCache = new WeakMap<
  Record<string, ResultNode>,
  Map<string, ResultSetFieldMapping[]>
>()

type ResultSetFieldMapping =
  | {
      type: 'field'
      name: string
      dbName: string
      columnIndex: number
      fieldType: FieldType
    }
  | {
      type: 'rowObject'
      name: string
      fields: ResultSetFieldMapping[]
    }
  | {
      type: 'valueObject'
      name: string
      columnIndex: number
      node: Extract<ResultNode, { type: 'object' }>
    }

type FieldResultNode = FieldScalarTypeName | Extract<ResultNode, { fieldType: FieldType }>

function isFieldNode(node: ResultNode): node is FieldResultNode {
  return typeof node === 'string' || 'fieldType' in node
}

function getFieldType(node: FieldResultNode): FieldType {
  return typeof node === 'string' ? node : node.fieldType
}

function getDbName(name: string, node: FieldResultNode): string {
  return typeof node === 'string' ? name : (node.dbName ?? name)
}

function getResultNodeType(node: ResultNode): string | undefined {
  return typeof node === 'string' ? 'field' : (node.type ?? 'field')
}

function getFieldEntries(fields: Record<string, ResultNode>): [string, ResultNode][] {
  let entries = fieldEntriesCache.get(fields)
  if (!entries) {
    entries = Object.entries(fields)
    fieldEntriesCache.set(fields, entries)
  }
  return entries
}

export function applyDataMap(
  data: Value,
  structure: ResultNode,
  enums: Record<string, Record<string, string>>,
  resultFormat: QueryResultFormat = 'jsonProtocol',
): Value {
  if (isFieldNode(structure)) {
    return mapValue(data, '<result>', getFieldType(structure), enums, resultFormat)
  }

  switch (structure.type) {
    case 'affectedRows':
      if (typeof data !== 'number') {
        throw new DataMapperError(`Expected an affected rows count, got: ${typeof data} (${data})`)
      }
      return { count: data }

    case 'object':
      return mapArrayOrObject(data, structure.fields, enums, structure.skipNulls, resultFormat)

    default:
      assertNever(structure as never, `Invalid data mapping type: '${getResultNodeType(structure)}'`)
  }
}

export function applyDataMapToResultSet(
  resultSet: SqlResultSet,
  structure: Extract<ResultNode, { type: 'object' }>,
  enums: Record<string, Record<string, string>>,
  resultFormat: QueryResultFormat = 'jsonProtocol',
): PrismaObject[] {
  const rows = resultSet.rows
  if (rows.length === 0) {
    return []
  }

  const fieldMappings = getResultSetFieldMappings(structure.fields, resultSet.columnNames)
  const result = new Array<PrismaObject>(rows.length)

  for (let i = 0; i < rows.length; i++) {
    result[i] = mapResultSetRow(rows[i], fieldMappings, enums, resultFormat)
  }

  return result
}

function mapArrayOrObject(
  data: Value,
  fields: Record<string, ResultNode>,
  enums: Record<string, Record<string, string>>,
  skipNulls?: boolean,
  resultFormat: QueryResultFormat = 'jsonProtocol',
): PrismaObject | PrismaObject[] | null {
  if (data === null) return null

  if (Array.isArray(data)) {
    const rows = data as PrismaObject[]
    if (skipNulls) {
      const result: PrismaObject[] = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (row !== null) {
          result.push(mapObject(row, fields, enums, resultFormat))
        }
      }

      return result
    }

    const result = new Array<PrismaObject>(rows.length)
    for (let i = 0; i < rows.length; i++) {
      result[i] = mapObject(rows[i], fields, enums, resultFormat)
    }

    return result
  }

  if (typeof data === 'object') {
    const row = data as PrismaObject
    return mapObject(row, fields, enums, resultFormat)
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
    return mapArrayOrObject(decodedData, fields, enums, skipNulls, resultFormat)
  }

  throw new DataMapperError(`Expected an array or an object, got: ${typeof data}`)
}

// Recursive
function mapObject(
  data: PrismaObject,
  fields: Record<string, ResultNode>,
  enums: Record<string, Record<string, string>>,
  resultFormat: QueryResultFormat,
): PrismaObject {
  if (typeof data !== 'object') {
    throw new DataMapperError(`Expected an object, but got '${typeof data}'`)
  }

  const result = {}
  for (const [name, node] of getFieldEntries(fields)) {
    if (isFieldNode(node)) {
      const dbName = getDbName(name, node)
      if (Object.hasOwn(data, dbName)) {
        result[name] = mapField(data[dbName], dbName, getFieldType(node), enums, resultFormat)
      } else {
        throw new DataMapperError(
          `Missing data field (Value): '${dbName}'; ` + `node: ${JSON.stringify(node)}; data: ${JSON.stringify(data)}`,
        )
      }
      continue
    }

    switch (node.type) {
      case 'affectedRows': {
        throw new DataMapperError(`Unexpected 'AffectedRows' node in data mapping for field '${name}'`)
      }

      case 'object': {
        const { serializedName, fields: nodeFields, skipNulls } = node
        if (serializedName !== null && !Object.hasOwn(data, serializedName)) {
          throw new DataMapperError(
            `Missing data field (Object): '${name}'; ` + `node: ${JSON.stringify(node)}; data: ${JSON.stringify(data)}`,
          )
        }

        const target = serializedName !== null ? data[serializedName] : data
        result[name] = mapArrayOrObject(target, nodeFields, enums, skipNulls, resultFormat)
        break
      }

      default:
        assertNever(node as never, `DataMapper: Invalid data mapping node type: '${getResultNodeType(node)}'`)
    }
  }
  return result
}

function mapResultSetRow(
  row: unknown[],
  fieldMappings: ResultSetFieldMapping[],
  enums: Record<string, Record<string, string>>,
  resultFormat: QueryResultFormat,
): PrismaObject {
  const result = {}
  for (const mapping of fieldMappings) {
    switch (mapping.type) {
      case 'field': {
        result[mapping.name] = mapField(
          row[mapping.columnIndex],
          mapping.dbName,
          mapping.fieldType,
          enums,
          resultFormat,
        )
        break
      }

      case 'rowObject': {
        result[mapping.name] = mapResultSetRow(row, mapping.fields, enums, resultFormat)
        break
      }

      case 'valueObject': {
        const node = mapping.node
        result[mapping.name] = mapArrayOrObject(
          row[mapping.columnIndex] as Value,
          node.fields,
          enums,
          node.skipNulls,
          resultFormat,
        )
        break
      }

      default:
        assertNever(mapping, `DataMapper: Invalid result set field mapping type`)
    }
  }
  return result
}

function getResultSetFieldMappings(fields: Record<string, ResultNode>, columnNames: string[]): ResultSetFieldMapping[] {
  let fieldMappingsByColumnNames = resultSetFieldMappingsCache.get(fields)
  if (fieldMappingsByColumnNames === undefined) {
    fieldMappingsByColumnNames = new WeakMap<string[], ResultSetFieldMapping[]>()
    resultSetFieldMappingsCache.set(fields, fieldMappingsByColumnNames)
  }

  const fieldMappings = fieldMappingsByColumnNames.get(columnNames)
  if (fieldMappings !== undefined) {
    return fieldMappings
  }

  return getResultSetFieldMappingsForColumnNamesMiss(fields, columnNames, fieldMappingsByColumnNames)
}

function getResultSetFieldMappingsForColumnNamesMiss(
  fields: Record<string, ResultNode>,
  columnNames: string[],
  fieldMappingsByColumnNames: WeakMap<string[], ResultSetFieldMapping[]>,
): ResultSetFieldMapping[] {
  let fieldMappingsByColumnShape = resultSetFieldMappingsByShapeCache.get(fields)
  if (fieldMappingsByColumnShape === undefined) {
    fieldMappingsByColumnShape = new Map<string, ResultSetFieldMapping[]>()
    resultSetFieldMappingsByShapeCache.set(fields, fieldMappingsByColumnShape)
  }

  const columnShape = getColumnShape(columnNames)
  let newFieldMappings = fieldMappingsByColumnShape.get(columnShape)
  if (newFieldMappings === undefined) {
    newFieldMappings = buildResultSetFieldMappings(fields, getColumnIndexes(columnNames))
    fieldMappingsByColumnShape.set(columnShape, newFieldMappings)
  }
  fieldMappingsByColumnNames.set(columnNames, newFieldMappings)
  return newFieldMappings
}

function getColumnShape(columnNames: string[]): string {
  let shape = `${columnNames.length}`
  for (let i = 0; i < columnNames.length; i++) {
    const name = columnNames[i]
    shape += `:${name.length}:${name}`
  }
  return shape
}

function buildResultSetFieldMappings(
  fields: Record<string, ResultNode>,
  columnIndexes: Record<string, number>,
): ResultSetFieldMapping[] {
  const fieldEntries = getFieldEntries(fields)
  const result = new Array<ResultSetFieldMapping>(fieldEntries.length)

  for (let i = 0; i < fieldEntries.length; i++) {
    const [name, node] = fieldEntries[i]
    if (isFieldNode(node)) {
      const dbName = getDbName(name, node)
      const columnIndex = columnIndexes[dbName]
      if (columnIndex === undefined) {
        throw new DataMapperError(
          `Missing data field (Value): '${dbName}'; ` +
            `node: ${JSON.stringify(node)}; columns: ${JSON.stringify(Object.keys(columnIndexes))}`,
        )
      }

      result[i] = {
        type: 'field',
        name,
        dbName,
        columnIndex,
        fieldType: getFieldType(node),
      }
      continue
    }

    switch (node.type) {
      case 'affectedRows': {
        throw new DataMapperError(`Unexpected 'AffectedRows' node in data mapping for field '${name}'`)
      }

      case 'object': {
        const { serializedName } = node
        if (serializedName === null) {
          result[i] = {
            type: 'rowObject',
            name,
            fields: buildResultSetFieldMappings(node.fields, columnIndexes),
          }
          break
        }

        const columnIndex = columnIndexes[serializedName]
        if (columnIndex === undefined) {
          throw new DataMapperError(
            `Missing data field (Object): '${name}'; ` +
              `node: ${JSON.stringify(node)}; columns: ${JSON.stringify(Object.keys(columnIndexes))}`,
          )
        }

        result[i] = {
          type: 'valueObject',
          name,
          columnIndex,
          node,
        }
        break
      }

      default:
        assertNever(node as never, `DataMapper: Invalid data mapping node type: '${getResultNodeType(node)}'`)
    }
  }

  return result
}

function getColumnIndexes(columnNames: string[]): Record<string, number> {
  const cached = columnIndexesCache.get(columnNames)
  if (cached !== undefined) {
    return cached
  }

  const columnIndexes = Object.create(null) as Record<string, number>
  for (let i = 0; i < columnNames.length; i++) {
    columnIndexes[columnNames[i]] = i
  }
  columnIndexesCache.set(columnNames, columnIndexes)
  return columnIndexes
}

function mapField(
  value: unknown,
  columnName: string,
  fieldType: FieldType,
  enums: Record<string, Record<string, string>>,
  resultFormat: QueryResultFormat = 'jsonProtocol',
): unknown {
  if (value === null) {
    return typeof fieldType !== 'string' && fieldType.arity === 'list' ? [] : null
  }

  if (typeof fieldType !== 'string' && fieldType.arity === 'list') {
    const values = value as unknown[]
    const result = new Array<unknown>(values.length)
    for (let i = 0; i < values.length; i++) {
      result[i] = mapValue(values[i], `${columnName}[${i}]`, fieldType, enums, resultFormat)
    }
    return result
  }

  return mapValue(value, columnName, fieldType, enums, resultFormat)
}

function mapValue(
  value: unknown,
  columnName: string,
  scalarType: FieldType,
  enums: Record<string, Record<string, string>>,
  resultFormat: QueryResultFormat = 'jsonProtocol',
): unknown {
  const scalarTypeName = typeof scalarType === 'string' ? scalarType : scalarType.type

  switch (scalarTypeName) {
    case 'unsupported':
      return value

    case 'string': {
      if (typeof value !== 'string') {
        throw new DataMapperError(`Expected a string in column '${columnName}', got ${typeof value}: ${value}`)
      }
      return value
    }

    case 'int': {
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

    case 'bigint': {
      if (typeof value !== 'number' && typeof value !== 'string') {
        throw new DataMapperError(`Expected a bigint in column '${columnName}', got ${typeof value}: ${value}`)
      }
      if (resultFormat === 'js') {
        return BigInt(value)
      }
      return { $type: 'BigInt', value }
    }

    case 'float': {
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

    case 'boolean': {
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
      if (Array.isArray(value) || value instanceof Uint8Array) {
        for (const byte of value) {
          if (byte !== 0) return true
        }
        return false
      }
      throw new DataMapperError(`Expected a boolean in column '${columnName}', got ${typeof value}: ${value}`)
    }

    case 'decimal':
      if (typeof value !== 'number' && typeof value !== 'string' && !Decimal.isDecimal(value)) {
        throw new DataMapperError(`Expected a decimal in column '${columnName}', got ${typeof value}: ${value}`)
      }
      if (resultFormat === 'js') {
        return new Decimal(value)
      }
      return { $type: 'Decimal', value }

    case 'datetime': {
      if (typeof value === 'string') {
        const normalized = normalizeDateTime(value)
        if (resultFormat === 'js') {
          return new Date(normalized)
        }
        return { $type: 'DateTime', value: normalized }
      }
      if (typeof value === 'number' || value instanceof Date) {
        if (resultFormat === 'js') {
          return new Date(value)
        }
        return { $type: 'DateTime', value }
      }
      throw new DataMapperError(`Expected a date in column '${columnName}', got ${typeof value}: ${value}`)
    }

    case 'object': {
      if (resultFormat === 'js') {
        return JSON.parse(safeJsonStringify(value))
      }
      return { $type: 'Json', value: safeJsonStringify(value) }
    }

    case 'json': {
      // The value received here should normally be a string, but we cannot guarantee that,
      // because of SQLite databases like D1, which can return JSON scalars directly. We therefore
      // convert the value we receive to a string.
      if (resultFormat === 'js') {
        return JSON.parse(`${value}`)
      }
      return { $type: 'Json', value: `${value}` }
    }

    case 'bytes': {
      const bytesType = scalarType as Extract<FieldScalarType, { type: 'bytes' }>
      switch (bytesType.encoding) {
        case 'base64':
          if (typeof value !== 'string') {
            throw new DataMapperError(
              `Expected a base64-encoded byte array in column '${columnName}', got ${typeof value}: ${value}`,
            )
          }
          if (resultFormat === 'js') {
            const { buffer, byteOffset, byteLength } = Buffer.from(value, 'base64')
            return new Uint8Array(buffer, byteOffset, byteLength)
          }
          return { $type: 'Bytes', value }

        case 'hex':
          if (typeof value !== 'string' || !value.startsWith('\\x')) {
            throw new DataMapperError(
              `Expected a hex-encoded byte array in column '${columnName}', got ${typeof value}: ${value}`,
            )
          }
          if (resultFormat === 'js') {
            const { buffer, byteOffset, byteLength } = Buffer.from(value.slice(2), 'hex')
            return new Uint8Array(buffer, byteOffset, byteLength)
          }
          return { $type: 'Bytes', value: Buffer.from(value.slice(2), 'hex').toString('base64') }

        case 'array':
          if (Array.isArray(value)) {
            if (resultFormat === 'js') {
              return Uint8Array.from(value)
            }
            return { $type: 'Bytes', value: Buffer.from(value).toString('base64') }
          }
          if (value instanceof Uint8Array) {
            if (resultFormat === 'js') {
              return new Uint8Array(value)
            }
            return { $type: 'Bytes', value: Buffer.from(value).toString('base64') }
          }
          throw new DataMapperError(`Expected a byte array in column '${columnName}', got ${typeof value}: ${value}`)

        default:
          assertNever(bytesType.encoding, `DataMapper: Unknown bytes encoding: ${bytesType.encoding}`)
      }
      break
    }

    case 'enum': {
      const enumType = scalarType as Extract<FieldScalarType, { type: 'enum' }>
      const enumDef = enums[enumType.name]
      if (enumDef === undefined) {
        throw new DataMapperError(`Unknown enum '${enumType.name}'`)
      }
      const enumValue = enumDef[`${value}`]
      if (enumValue === undefined) {
        throw new DataMapperError(`Value '${value}' not found in enum '${enumType.name}'`)
      }
      return enumValue
    }

    default:
      assertNever(scalarTypeName, `DataMapper: Unknown result type: ${scalarTypeName}`)
  }
}

/**
 * A regular expression that matches a time string with an optional timezone.
 * It matches formats like:
 * - `12:34:56`
 * - `12:34:56.789`
 * - `12:34:56Z`
 * - `12:34:56+02`
 * - `12:34:56-02:30`
 */
const TIME_TZ_PATTERN = /\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)?$/

/**
 * Normalizes date time strings received from driver adapters. The returned string is always a
 * valid input for the Javascript `Date` constructor. This function will add a UTC timezone suffix
 * if there's no timezone specified, to prevent it from being interpreted as local time.
 */
function normalizeDateTime(dt: string): string {
  const timeTzMatches = TIME_TZ_PATTERN.exec(dt)
  if (timeTzMatches === null) {
    // We found no time part, so we return it as a plain zulu date,
    // e.g. '2023-10-01T00:00Z'.
    // We append the time because the JS Date constructor can't parse
    // pre-1000 dates with a timezone, for example '0032-01-01Z' parses
    // as '2032-01-01T00:00:00.000Z'.
    return `${dt}T00:00:00Z`
  }

  let dtWithTz = dt
  const [timeTz, tz, tzMinuteOffset] = timeTzMatches
  if (tz !== undefined && tz !== 'Z' && tzMinuteOffset === undefined) {
    // If the timezone is specified as +HH or -HH (without minutes),
    // we need to suffix it with ':00' to make it a valid Date input.
    dtWithTz = `${dt}:00`
  } else if (tz === undefined) {
    // If the timezone is not specified at all, we suffix it with 'Z'.
    dtWithTz = `${dt}Z`
  }

  if (timeTz.length === dt.length) {
    // If the entire datetime was just the time, we prepend the unix epoch date.
    return `1970-01-01T${dtWithTz}`
  }

  const timeSeparatorIndex = timeTzMatches.index - 1
  // If the time part is preceded by a space, we replace it with 'T'.
  if (dtWithTz[timeSeparatorIndex] === ' ') {
    dtWithTz = `${dtWithTz.slice(0, timeSeparatorIndex)}T${dtWithTz.slice(timeSeparatorIndex + 1)}`
  }

  return dtWithTz
}
