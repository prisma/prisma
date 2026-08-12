import { canonicalize } from './canonicalize';
import type { MongoSchemaIndex } from './schema-index';

/**
 * Key-order-sensitive structural comparison. For key-order-independent
 * comparison (e.g. lookup key construction), use {@link canonicalize}.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i++) {
      if (aKeys[i] !== bKeys[i]) return false;
      const key = aKeys[i] as string;
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  return false;
}

export function indexesEquivalent(a: MongoSchemaIndex, b: MongoSchemaIndex): boolean {
  if (a.keys.length !== b.keys.length) return false;
  for (let i = 0; i < a.keys.length; i++) {
    const aKey = a.keys[i];
    const bKey = b.keys[i];
    if (!aKey || !bKey) return false;
    if (aKey.field !== bKey.field) return false;
    if (aKey.direction !== bKey.direction) return false;
  }
  if (a.unique !== b.unique) return false;
  if (a.sparse !== b.sparse) return false;
  if (a.expireAfterSeconds !== b.expireAfterSeconds) return false;
  if (canonicalize(a.partialFilterExpression) !== canonicalize(b.partialFilterExpression))
    return false;
  if (canonicalize(a.wildcardProjection) !== canonicalize(b.wildcardProjection)) return false;
  if (canonicalize(a.collation) !== canonicalize(b.collation)) return false;
  if (canonicalize(a.weights) !== canonicalize(b.weights)) return false;
  if (a.default_language !== b.default_language) return false;
  if (a.language_override !== b.language_override) return false;
  return true;
}
