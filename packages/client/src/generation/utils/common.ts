import type { DMMF } from '../dmmf-types'

export interface Dictionary<T> {
  [key: string]: T
}

export const keyBy: <T>(collection: readonly T[], prop: string) => Dictionary<T> = (collection, prop) => {
  const acc = {}

  for (const obj of collection) {
    const key = obj[prop]
    acc[key] = obj
  }
  return acc
}

export const needNamespace = {
  Json: 'JsonValue',
  Decimal: 'Decimal',
}

export function needsNamespace(field: DMMF.Field): boolean {
  if (field.kind === 'object') {
    return true
  }

  if (field.kind === 'scalar') {
    return field.type === 'Json' || field.type === 'Decimal'
  }
  return false
}

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
  Bytes: 'Uint8Array',
  Decimal: ['Decimal', 'DecimalJsLike', 'number', 'string'],
  BigInt: ['bigint', 'number'],
}

export const JSOutputTypeToInputType = {
  JsonValue: 'InputJsonValue',
}

export const JSTypeToGraphQLType = {
  string: 'String',
  boolean: 'Boolean',
  object: 'Json',
  symbol: 'Symbol',
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
