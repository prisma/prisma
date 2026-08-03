import type { MongoIndexKey, MongoIndexKeyDirection } from '@internal/mongo-contract';

export function buildIndexOpId(
  verb: 'create' | 'drop',
  collection: string,
  keys: ReadonlyArray<MongoIndexKey>,
): string {
  const keyStr = keys.map((k) => `${k.field}:${k.direction}`).join(',');
  return `index.${collection}.${verb}(${keyStr})`;
}

export function defaultMongoIndexName(keys: ReadonlyArray<MongoIndexKey>): string {
  return keys.map((k) => `${k.field}_${k.direction}`).join('_');
}

export function keysToKeySpec(
  keys: ReadonlyArray<MongoIndexKey>,
): Record<string, MongoIndexKeyDirection> {
  const spec: Record<string, MongoIndexKeyDirection> = {};
  for (const k of keys) {
    spec[k.field] = k.direction;
  }
  return spec;
}
