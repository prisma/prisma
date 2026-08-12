import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';

export function sqlTestStorageWithTables(tables: Record<string, unknown>) {
  return {
    namespaces: {
      [UNBOUND_NAMESPACE_ID]: {
        id: UNBOUND_NAMESPACE_ID,
        tables,
      },
    },
  };
}
