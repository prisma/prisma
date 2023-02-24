import { JsonOutputTaggedValue } from '@prisma/engine-core'
import { assertNever, mapObjectValues } from '@prisma/internals'
import Decimal from 'decimal.js'

import { JsOutputValue } from '../../types/JsApi'

export function deserializeJsonResponse(result: unknown): unknown {
  if (result === null) {
    return result
  }

  if (Array.isArray(result)) {
    return result.map(deserializeJsonResponse)
  }

  if (typeof result === 'object') {
    if (isTaggedValue(result)) {
      return deserializeTaggedValue(result)
    }

    return mapObjectValues(result, deserializeJsonResponse)
  }

  return result
}

function isTaggedValue(value: unknown): value is JsonOutputTaggedValue {
  return value !== null && typeof value == 'object' && typeof value['$type'] === 'string'
}

function deserializeTaggedValue({ $type, value }: JsonOutputTaggedValue): JsOutputValue {
  switch ($type) {
    case 'BigInt':
      return BigInt(value)
    case 'Bytes':
      return Buffer.from(value, 'base64')
    case 'DateTime':
      return new Date(value)
    case 'Decimal':
      return new Decimal(value)
    case 'Json':
      return JSON.parse(value)
    default:
      assertNever(value, 'Unknown tagged value')
  }
}
