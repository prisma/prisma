import { canonicalize } from './canonicalize';
import type { MongoSchemaIndex, MongoSchemaIndexOptions } from './schema-index';

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

/** The index options that tell two indexes on the same keys apart. */
export const MONGO_INDEX_OPTION_KEYS = [
  'unique',
  'sparse',
  'expireAfterSeconds',
  'partialFilterExpression',
  'wildcardProjection',
  'collation',
  'weights',
  'default_language',
  'language_override',
] as const satisfies readonly Exclude<keyof MongoSchemaIndexOptions, 'keys'>[];

export type MongoIndexOptionKey = (typeof MONGO_INDEX_OPTION_KEYS)[number];

function keysOf(index: MongoSchemaIndex): string {
  return index.keys.map((k) => `${k.field}:${k.direction}`).join(',');
}

export function indexesEquivalent(a: MongoSchemaIndex, b: MongoSchemaIndex): boolean {
  return (
    keysOf(a) === keysOf(b) &&
    MONGO_INDEX_OPTION_KEYS.every((option) => canonicalize(a[option]) === canonicalize(b[option]))
  );
}

/** Identifies an index by its keys and the options it sets; an option set to `false` counts as unset. */
export function indexLookupKey(index: MongoSchemaIndex): string {
  const options = MONGO_INDEX_OPTION_KEYS.flatMap((option) => {
    const value = index[option];
    return value === undefined || value === null || value === false
      ? []
      : [`${option}:${canonicalize(value)}`];
  });
  return options.length > 0 ? `${keysOf(index)}|${options.join(';')}` : keysOf(index);
}
