import type { PreserveEmptyPredicate } from '@internal/contract/hashing';
import { computeProfileHash, computeStorageHash } from '@internal/contract/hashing';
import { describe, expect, it } from 'vitest';

const emptyNamespacedStorage = () => ({
  namespaces: {
    __unbound__: { id: '__unbound__' as const, entries: { table: {} } },
  },
});

const sqlPreserveEmpty: PreserveEmptyPredicate = (path) => {
  const len = path.length;
  if (len < 2 || path[0] !== 'storage') return false;
  if (path[1] === 'namespaces' && len === 4 && path[3] === 'tables') return true;
  return false;
};

const SQL_HOOKS = { shouldPreserveEmpty: sqlPreserveEmpty };

describe('hashing', () => {
  it('computes storage hash', () => {
    const hash = computeStorageHash({
      targetFamily: 'sql',
      target: 'postgres',
      storage: emptyNamespacedStorage(),
      ...SQL_HOOKS,
    });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('computes profile hash', () => {
    const hash = computeProfileHash({
      targetFamily: 'sql',
      target: 'postgres',
      capabilities: { postgres: { jsonAgg: true } },
    });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces stable hashes for identical input', () => {
    const args = {
      targetFamily: 'sql',
      target: 'postgres',
      storage: emptyNamespacedStorage(),
      ...SQL_HOOKS,
    };

    const hash1 = computeStorageHash(args);
    const hash2 = computeStorageHash(args);
    expect(hash1).toBe(hash2);
  });
});
