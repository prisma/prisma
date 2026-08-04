/**
 * Shared relational-diff types and helpers. The coordinate-based issue diff
 * this module used to house (`collectSqlSchemaIssues` /
 * `collectSqlSchemaIssuesPerNamespace`) retired once the migration planner
 * took `plan(start, end)` over the one differ (`buildPostgresPlanDiff` /
 * `buildSqlitePlanDiff`); what remains here is consumed by the surviving
 * verify verdict (`schema-verify.ts`) and the control adapters.
 */

import type { ColumnDefault } from '@internal/contract/types';

/**
 * Function type for normalizing raw database default expressions into ColumnDefault.
 * Target-specific implementations handle database dialect differences.
 */
export type DefaultNormalizer = (
  rawDefault: string,
  nativeType: string,
) => ColumnDefault | undefined;

/**
 * Function type for normalizing schema native types to canonical form for comparison.
 * Target-specific implementations handle dialect-specific type name variations
 * (e.g., Postgres 'varchar' → 'character varying', 'timestamptz' normalization).
 */
export type NativeTypeNormalizer = (nativeType: string) => string;

/**
 * Compares two arrays of strings for equality (order-sensitive).
 */
export function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
