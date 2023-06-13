import { DMMFHelper } from '../dmmf'
import type { DMMF } from '../dmmf-types'

export interface Dictionary<T> {
  [key: string]: T
}

export const keyBy: <T>(collection: T[], prop: string) => Dictionary<T> = (collection, prop) => {
  const acc = {}

  for (const obj of collection) {
    const key = obj[prop]
    acc[key] = obj
  }
  return acc
}

export const ScalarTypeTable = {
  String: true,
  Int: true,
  Float: true,
  Boolean: true,
  Long: true,
  DateTime: true,
  ID: true,
  UUID: true,
  Json: true,
  Bytes: true,
  Decimal: true,
  BigInt: true,
}

// TODO: move to /generation
export const needNamespace = {
  Json: 'JsonValue',
  Decimal: 'Decimal',
}

// TODO: move to /generation
export function needsNamespace(fieldType: DMMF.SchemaField['outputType']['type'], dmmf: DMMFHelper): boolean {
  if (typeof fieldType === 'string') {
    if (dmmf.datamodelEnumMap[fieldType]) {
      return false
    }
    if (GraphQLScalarToJSTypeTable[fieldType]) {
      return Boolean(needNamespace[fieldType])
    }
  }

  return true
}

// TODO: move to /generation
export const GraphQLScalarToJSTypeTable = {
  String: 'string',
  Int: 'number',
  Float: 'number',
  Boolean: 'boolean',
  Long: 'number',
  DateTime: ['Date', 'string'],
  ID: 'string',
  UUID: 'string',
  Json: 'JsonValue',
  Bytes: 'Buffer',
  Decimal: ['Decimal', 'DecimalJsLike', 'number', 'string'],
  BigInt: ['bigint', 'number'],
}

// TODO: move to /generation
export const JSOutputTypeToInputType = {
  JsonValue: 'InputJsonValue',
}

// TODO: move to /generation
export const JSTypeToGraphQLType = {
  string: 'String',
  boolean: 'Boolean',
  object: 'Json',
  symbol: 'Symbol',
}

// TODO: move to generation
export function argIsInputType(arg: DMMF.ArgType): arg is DMMF.InputType {
  if (typeof arg === 'string') {
    return false
  }

  return true
}

export function capitalize(str: string): string {
  return str[0].toUpperCase() + str.slice(1)
}

/**
 * Converts the first character of a word to lower case
 * @param name
 */
export function lowerCase(name: string): string {
  return name.substring(0, 1).toLowerCase() + name.substring(1)
}

// TODO: move to /generation
export function isSchemaEnum(type: any): type is DMMF.SchemaEnum {
  return typeof type === 'object' && type !== null && typeof type.name === 'string' && Array.isArray(type.values)
}
