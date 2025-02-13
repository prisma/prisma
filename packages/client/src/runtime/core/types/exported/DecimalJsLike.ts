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
