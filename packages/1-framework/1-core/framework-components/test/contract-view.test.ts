import { describe, expect, it } from 'vitest';
import { buildNamespacedEntities, buildSingleNamespaceView } from '../src/ir/contract-view';
import { UNBOUND_NAMESPACE_ID } from '../src/ir/namespace';
import type { Storage } from '../src/ir/storage';

function storageWith(entries: Record<string, unknown>): Storage {
  return {
    namespaces: {
      [UNBOUND_NAMESPACE_ID]: { id: UNBOUND_NAMESPACE_ID, kind: 'test-namespace', entries },
    },
  } as unknown as Storage;
}

function multiNamespaceStorage(namespaces: Record<string, Record<string, unknown>>): Storage {
  return {
    namespaces: Object.fromEntries(
      Object.entries(namespaces).map(([id, entries]) => [
        id,
        { id, kind: 'test-namespace', entries },
      ]),
    ),
  } as unknown as Storage;
}

describe('buildSingleNamespaceView', () => {
  it('promotes built-in kinds to top-level and keeps pack kinds under .entries', () => {
    const table = { users: { name: 'users' } };
    const policy = { readAll: { name: 'readAll' } };
    const view = buildSingleNamespaceView<{
      table: typeof table;
      valueSet: Record<string, never>;
      entries: { policy: typeof policy };
    }>(storageWith({ table, policy }), ['table', 'valueSet']);

    expect(view.table).toBe(table);
    expect(view.entries.policy).toBe(policy);
    expect(Object.keys(view.entries)).toEqual(['policy']);
  });

  it('materializes a missing built-in kind as an empty map', () => {
    const view = buildSingleNamespaceView<{
      table: Record<string, unknown>;
      valueSet: Record<string, never>;
      entries: Record<string, never>;
    }>(storageWith({ table: { t: {} } }), ['table', 'valueSet']);

    expect(view.valueSet).toEqual({});
  });

  it('.entries excludes every built-in kind', () => {
    const view = buildSingleNamespaceView<{
      table: Record<string, unknown>;
      valueSet: Record<string, unknown>;
      entries: Record<string, unknown>;
    }>(storageWith({ table: {}, valueSet: {}, policy: {} }), ['table', 'valueSet']);

    expect(Object.keys(view.entries)).toEqual(['policy']);
  });

  it('throws when the contract has no default namespace', () => {
    const storage = { namespaces: {} } as unknown as Storage;
    expect(() => buildSingleNamespaceView(storage, ['table'])).toThrow(/default namespace/);
  });
});

describe('buildNamespacedEntities', () => {
  it('keys every namespace by raw id, each kind-promoted (mirrors buildNamespacedEnums)', () => {
    const storage = multiNamespaceStorage({
      public: { table: { users: { c: 1 } } },
      auth: { table: { sessions: { c: 2 } } },
    });
    const ns = buildNamespacedEntities<{
      public: { table: { users: unknown }; entries: object };
      auth: { table: { sessions: unknown }; entries: object };
    }>(storage, ['table', 'valueSet']);

    expect(Object.keys(ns).sort()).toEqual(['auth', 'public']);
    expect(ns.public.table.users).toEqual({ c: 1 });
    expect(ns.auth.table.sessions).toEqual({ c: 2 });
  });

  it('a schema named `storage` is a normal key under the map (collision-proof by nesting)', () => {
    const storage = multiNamespaceStorage({
      storage: { table: { secrets: { c: 1 } } },
      public: { table: { widgets: { c: 2 } } },
    });
    const ns = buildNamespacedEntities<{
      storage: { table: { secrets: unknown }; entries: object };
      public: { table: { widgets: unknown }; entries: object };
    }>(storage, ['table', 'valueSet']);

    expect(ns.storage.table.secrets).toEqual({ c: 1 });
    expect(ns.public.table.widgets).toEqual({ c: 2 });
  });
});
