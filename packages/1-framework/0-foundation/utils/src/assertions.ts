import { InternalError } from './internal-error';

/**
 * Asserts that a value is defined (not null or undefined).
 * Use for invariants where the value should always exist at runtime.
 *
 * @throws Error if value is null or undefined
 *
 * @example
 * ```typescript
 * const table = storage.namespaces[namespaceId].entries.table[tableName];
 * assertDefined(table, `Table "${tableName}" not found`);
 * // table is now narrowed to non-nullable
 * ```
 */
export function assertDefined<T>(value: T | null | undefined, message: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new InternalError(message);
  }
}

/**
 * Asserts that a condition is true.
 * Use for invariants that should always hold at runtime.
 *
 * @throws Error if condition is false
 *
 * @example
 * ```typescript
 * invariant(columns.length > 0, 'Primary key must have at least one column');
 * ```
 */
export function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new InternalError(message);
  }
}
