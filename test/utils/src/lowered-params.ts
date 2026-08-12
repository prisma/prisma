/**
 * Test fixtures for the `LoweredParam` discriminated union exposed by
 * `@internal/sql-relational-core/ast`. Defined locally so test-utils
 * stays free of internal-package dependencies; the shape is structurally
 * identical to the production type.
 */

export type LoweredLiteralParam = { readonly kind: 'literal'; readonly value: unknown };
export type LoweredBindParam = { readonly kind: 'bind'; readonly name: string };
export type LoweredParamFixture = LoweredLiteralParam | LoweredBindParam;

/**
 * Wrap each value in a `{ kind: 'literal', value }` slot. Use in adapter
 * tests that assert on `lowered.params` shape:
 *
 * ```ts
 * expect(lowered.params).toEqual(litParams('hello', 1));
 * ```
 */
export function litParams(...values: unknown[]): LoweredLiteralParam[] {
  return values.map((value) => ({ kind: 'literal' as const, value }));
}

/**
 * Wrap each name in a `{ kind: 'bind', name }` slot. Use when asserting
 * on prepared-statement bind-site lowering output.
 */
export function bindParams(...names: string[]): LoweredBindParam[] {
  return names.map((name) => ({ kind: 'bind' as const, name }));
}
