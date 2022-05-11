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
}

export function isDecimalJsLike(value: unknown): value is DecimalJsLike {
  if (Decimal.isDecimal(value)) {
    return true
  }
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as any).s === 'number' &&
    typeof (value as any).e === 'number' &&
    Array.isArray((value as any).d)
  )
}

export function stringifyDecimalJsLike(value: DecimalJsLike): string {
  if (Decimal.isDecimal(value)) {
    return String(value)
  }

  const tmpDecimal = new Decimal(0) as DecimalJsLike
  tmpDecimal.d = value.d
  tmpDecimal.e = value.e
  tmpDecimal.s = value.s
  return String(tmpDecimal)
}
