/**
 * Canonicalizes SQLite native-type tokens for verifier comparison.
 * Lives target-side so the planner / runner / adapter all share the same
 * normalization without crossing the `target-sqlite` ↔ `adapter-sqlite`
 * boundary.
 */
export function normalizeSqliteNativeType(nativeType: string): string {
  return nativeType.trim().toLowerCase();
}
