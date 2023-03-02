import { Decimal } from 'decimal.js'
/**
 * Interface for any Decimal.js-like library
 * Allows us to accept Decimal.js from different
 * versions and some compatible alternatives
 */
export interface DecimalJsLike {
  d: number[]
  e: number
  s: number
  toFixed(): string
}

export function isDecimalJsLike(value: unknown): value is DecimalJsLike {
  if (Decimal.isDecimal(value)) {
    return true
  }
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value['s'] === 'number' &&
    typeof value['e'] === 'number' &&
    typeof value['toFixed'] === 'function' &&
    Array.isArray(value['d'])
  )
}
