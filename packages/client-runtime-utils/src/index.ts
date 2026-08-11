import { Decimal as DecimalJS } from 'decimal.js'

export * from './errors'
export * from './nullTypes'

/**
 * Prisma's `Decimal` (re-exported to users as `Prisma.Decimal`) is decimal.js,
 * whose `valueOf()` returns a *string*. Relational operators (`<`, `>`, `<=`,
 * `>=`) and `Number()` coerce operands with the `"number"` hint, which without
 * this override falls back to `valueOf()`/`toString()` — so
 * `new Decimal('10.1') < new Decimal('9.99')` compared the strings `'10.1' <
 * '9.99'` and evaluated to `true` (the wrong answer).
 *
 * Overriding `Symbol.toPrimitive` (which takes precedence over `valueOf`)
 * resolves the `"number"` hint to the actual numeric value while leaving the
 * `"string"` and `"default"` hints on the existing string representation, so
 * `toString()`, `toJSON()`, template literals, string concatenation and
 * `JSON.stringify` are all unchanged. Only the comparison contexts that were
 * wrong become numerically correct.
 *
 * The class subclasses `decimal.js` (which constructs internally via
 * `x.constructor`, so subclassing is supported) rather than mutating the shared
 * `decimal.js` prototype, so third-party `import Decimal from 'decimal.js'`
 * usage in the same process is unaffected.
 *
 * https://github.com/prisma/prisma/issues/29882
 */
export class Decimal extends DecimalJS {
  [Symbol.toPrimitive](hint: 'default' | 'number' | 'string'): number | string {
    if (hint === 'number') return Number(this.toString())
    return this.toString()
  }
}

export { empty, join, raw, type RawValue, Sql, default as sql, type Value } from 'sql-template-tag'
