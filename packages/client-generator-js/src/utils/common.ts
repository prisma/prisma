import type * as DMMF from '@prisma/dmmf'

export function isGeometryScalarTypeRef(ref: Pick<DMMF.OutputTypeRef, 'location' | 'type'>): boolean {
  return ref.location === 'scalar' && ref.type.startsWith('geometry(')
}

export const needNamespace = {
  Json: 'JsonValue',
  Decimal: 'Decimal',
  Bytes: 'Bytes',
  Point: 'Point',
  LineString: 'LineString',
  Polygon: 'Polygon',
  Geometry: 'Geometry',
}

export function needsNamespace(field: DMMF.Field): boolean {
  if (field.kind === 'object') {
    return true
  }

  if (field.kind === 'scalar') {
    return Object.prototype.hasOwnProperty.call(needNamespace, field.type)
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
  Bytes: 'Bytes',
  Decimal: ['Decimal', 'DecimalJsLike', 'number', 'string'],
  BigInt: ['bigint', 'number'],
  Point: 'Point',
  LineString: 'LineString',
  Polygon: 'Polygon',
  Geometry: 'Geometry',
}

export const JSOutputTypeToInputType = {
  JsonValue: 'InputJsonValue',
  Geometry: 'InputGeometry',
}

export const JSTypeToGraphQLType = {
  string: 'String',
  boolean: 'Boolean',
  object: 'Json',
  symbol: 'Symbol',
}
