import { QueryIntrospectionType } from '@prisma/generator-helper'

import * as ts from '../ts-builders'

type TypeMappingConfig = {
  in: ts.TypeBuilder
  out: ts.TypeBuilder
}

const decimal = ts.namedType('$runtime.Decimal')
const buffer = ts.namedType('Buffer')
const date = ts.namedType('Date')

const dateIn = ts.unionType([ts.stringType, date])
const bigintInt = ts.unionType([ts.numberType, ts.stringType, ts.bigintType])
const decimalIn = ts.unionType([ts.numberType, ts.stringType, decimal])

const typeMappings: Record<QueryIntrospectionType, TypeMappingConfig | ts.TypeBuilder> = {
  unknown: ts.unknownType,
  string: ts.stringType,
  int: ts.numberType,
  bigint: {
    in: bigintInt,
    out: ts.bigintType,
  },
  decimal: {
    in: decimalIn,
    out: decimal,
  },
  float: ts.numberType,
  double: ts.numberType,
  enum: ts.stringType, // TODO:
  bytes: buffer,
  bool: ts.booleanType,
  char: ts.stringType,
  json: ts.stringType,
  xml: ts.stringType,
  uuid: ts.stringType,
  date: {
    in: dateIn,
    out: date,
  },
  datetime: {
    in: dateIn,
    out: date,
  },
  time: {
    in: dateIn,
    out: date,
  },
  'int-array': ts.array(ts.numberType),
  'string-array': ts.array(ts.stringType),
  'json-array': ts.array(ts.stringType),
  'uuid-array': ts.array(ts.stringType),
  'xml-array': ts.array(ts.stringType),
  'bigint-array': ts.array(bigintInt),
  'float-array': ts.array(ts.numberType),
  'double-array': ts.array(ts.numberType),
  'char-array': ts.array(ts.stringType),
  'bytes-array': ts.array(buffer),
  'bool-array': ts.array(ts.booleanType),
  'date-array': {
    in: ts.array(dateIn),
    out: date,
  },
  'time-array': {
    in: ts.array(dateIn),
    out: date,
  },
  'datetime-array': {
    in: ts.array(dateIn),
    out: date,
  },
  'decimal-array': {
    in: ts.array(decimalIn),
    out: decimal,
  },
}

export function getInputType(introspectionType: QueryIntrospectionType): ts.TypeBuilder {
  return getMappingConfig(introspectionType).in
}

export function getOutputType(introspectionType: QueryIntrospectionType): ts.TypeBuilder {
  return getMappingConfig(introspectionType).out
}

function getMappingConfig(introspectionType: QueryIntrospectionType) {
  const config = typeMappings[introspectionType]
  if (config instanceof ts.TypeBuilder) {
    return { in: config, out: config }
  }
  return config
}
