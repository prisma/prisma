/**
 * Postgres native-type normalization.
 *
 * Lives in `target-postgres` because both the migration planner/runner (control
 * plane) and the introspection adapter (control plane) need to normalize raw
 * native-type strings to the same canonical form for comparison.
 */

/**
 * Lookup map for simple prefix-based type normalization.
 *
 * Using a Map for O(1) lookup instead of multiple startsWith checks.
 */
const TYPE_PREFIX_MAP: ReadonlyMap<string, string> = new Map([
  ['varchar', 'character varying'],
  ['bpchar', 'character'],
  ['varbit', 'bit varying'],
]);

/**
 * Normalizes a Postgres schema native type to its canonical form for comparison.
 *
 * Uses a pre-computed lookup map for simple prefix replacements (O(1))
 * and handles complex temporal type normalization separately.
 */
export function normalizeSchemaNativeType(nativeType: string): string {
  const trimmed = nativeType.trim();

  for (const [prefix, replacement] of TYPE_PREFIX_MAP) {
    if (trimmed.startsWith(prefix)) {
      return replacement + trimmed.slice(prefix.length);
    }
  }

  if (trimmed.includes(' with time zone')) {
    if (trimmed.startsWith('timestamp')) {
      return `timestamptz${trimmed.slice(9).replace(' with time zone', '')}`;
    }
    if (trimmed.startsWith('time')) {
      return `timetz${trimmed.slice(4).replace(' with time zone', '')}`;
    }
  }

  if (trimmed.includes(' without time zone')) {
    return trimmed.replace(' without time zone', '');
  }

  return trimmed;
}
