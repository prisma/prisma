import { type Contract, coreHash, type StorageNamespace } from '@internal/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';

/**
 * `Contract['storage']` widened with the SQL-family `types` slot, which the
 * generic foundation `StorageBase` doesn't carry. Test fixtures build this
 * shape and hand it to `sqlEmission` (which reads `contract.storage.types`
 * via its own internal cast), never the other way around.
 */
type EmitterTestStorage = Contract['storage'] & { readonly types?: Record<string, unknown> };

function makeRawNamespace(id: string, entries: Record<string, unknown>): StorageNamespace {
  return { id, kind: 'test-sql-namespace', entries } as unknown as StorageNamespace;
}

export function namespacedSqlStorage(parts: {
  readonly tables: Record<string, unknown>;
  readonly types?: Record<string, unknown>;
}): EmitterTestStorage {
  return {
    storageHash: coreHash('test'),
    namespaces: {
      [UNBOUND_NAMESPACE_ID]: makeRawNamespace(UNBOUND_NAMESPACE_ID, { table: parts.tables }),
    },
    ...(parts.types !== undefined ? { types: parts.types } : {}),
  };
}

/**
 * Normalizes the loose storage shapes used throughout this package's tests
 * (flat `{ tables }`, pre-namespaced `{ namespaces }` missing a `storageHash`,
 * or a bare `{ entries }` block) into a well-typed `Contract['storage']`.
 * Anything else (e.g. `{}`, or a deliberately-forced `undefined`) passes
 * through unchanged so tests exercising malformed/absent storage still see
 * exactly the value they authored.
 */
export function normalizeRootSqlStorage(
  storage: Record<string, unknown> | undefined,
): EmitterTestStorage | undefined {
  if (storage === undefined || storage === null) {
    return storage;
  }
  const s = storage;
  if ('namespaces' in s) {
    const namespaces = s['namespaces'];
    if (namespaces !== null && typeof namespaces === 'object' && !Array.isArray(namespaces)) {
      const lifted = Object.fromEntries(
        Object.entries(namespaces as Record<string, Record<string, unknown>>).map(([id, ns]) => {
          if (ns === null || typeof ns !== 'object' || Array.isArray(ns)) {
            return [id, ns];
          }
          if ('entries' in ns) {
            const nsId = typeof ns['id'] === 'string' ? ns['id'] : id;
            const kind = typeof ns['kind'] === 'string' ? ns['kind'] : 'test-sql-namespace';
            return [id, { ...ns, id: nsId, kind }];
          }
          if ('tables' in ns) {
            const nsId = typeof ns['id'] === 'string' ? ns['id'] : id;
            return [id, makeRawNamespace(nsId, { table: ns['tables'] as Record<string, unknown> })];
          }
          return [id, ns];
        }),
      ) as Readonly<Record<string, StorageNamespace>>;
      const rawHash = s['storageHash'];
      const storageHash = typeof rawHash === 'string' ? rawHash : 'test';
      return {
        storageHash: coreHash(storageHash),
        namespaces: lifted,
        ...(s['types'] !== undefined ? { types: s['types'] as Record<string, unknown> } : {}),
      };
    }
    return storage as unknown as EmitterTestStorage;
  }
  if ('tables' in s) {
    return namespacedSqlStorage({
      tables: s['tables'] as Record<string, unknown>,
      ...(s['types'] !== undefined ? { types: s['types'] as Record<string, unknown> } : {}),
    });
  }
  const entries = s['entries'];
  if (entries !== null && typeof entries === 'object' && !Array.isArray(entries)) {
    const table = (entries as Record<string, unknown>)['table'];
    if (table !== undefined) {
      return namespacedSqlStorage({
        tables: table as Record<string, unknown>,
        ...(s['types'] !== undefined ? { types: s['types'] as Record<string, unknown> } : {}),
      });
    }
  }
  return storage as unknown as EmitterTestStorage;
}
