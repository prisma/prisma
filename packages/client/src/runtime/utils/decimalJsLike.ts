import { Decimal } from 'decimal.js'

import type { DecimalJsLike } from '../core/types/exported/DecimalJsLike'

export function isDecimalJsLike(value: unknown): value is DecimalJsLike {
  if (Decimal.isDecimal(value)) {
    return true
  }
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.s === 'number' &&
    typeof value.e === 'number' &&
    typeof value.toFixed === 'function' &&
    Array.isArray(value.d)
  )
}
