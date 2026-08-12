import type { SqlStorage, StorageTable } from '@internal/sql-contract/types';

const POSTGRES_DEFAULT_NAMESPACE_ID = 'public' as const;

type StorageLike = {
  readonly namespaces: Readonly<
    Record<string, { readonly entries?: { readonly table?: Readonly<Record<string, unknown>> } }>
  >;
};

export function unboundTables(
  storage: StorageLike | SqlStorage,
): Readonly<Record<string, StorageTable>> {
  return (storage.namespaces[POSTGRES_DEFAULT_NAMESPACE_ID]!.entries!.table ?? {}) as Readonly<
    Record<string, StorageTable>
  >;
}
