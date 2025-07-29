import type * as DMMF from '@prisma/dmmf'

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
