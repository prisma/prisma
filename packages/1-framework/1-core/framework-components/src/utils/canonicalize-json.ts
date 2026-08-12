function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  const sorted: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * `JSON.stringify` with object keys sorted lexicographically at every level. Two structurally equal values produce the same string regardless of object key insertion order, so the result is a stable cache key for JSON-shaped values.
 *
 * Array order is preserved; primitives serialise as their JSON form. Inputs are expected to be JSON-safe (the typeParams shape on {@link CodecRef} is `JsonValue`-constrained for this reason); callers that need to canonicalise non-JSON-safe values (BigInt, Dates, typed arrays) should use `canonicalStringify` from `@internal/utils/canonical-stringify` instead.
 */
export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
