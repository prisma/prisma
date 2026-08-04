import type { SqlNamespace, StorageTable } from '@internal/sql-contract/types';
import { blindCast } from '@internal/utils/casts';

type StorageLike = {
  readonly namespaces: Readonly<Record<string, unknown>>;
};

export function unboundTables(storage: StorageLike): Readonly<Record<string, StorageTable>> {
  const merged: Record<string, StorageTable> = {};
  for (const ns of Object.values(storage.namespaces)) {
    Object.assign(
      merged,
      blindCast<
        SqlNamespace,
        'runtime namespaces hold SqlNamespaceBase concretions that satisfy SqlNamespace'
      >(ns).entries.table ?? {},
    );
  }
  return merged;
}
