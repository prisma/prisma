import { asNamespaceId, type Contract, coreHash, profileHash } from '@internal/contract/types';
import type { MigrationOperationPolicy } from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import type { ReferentialAction, StorageColumn } from '@internal/sql-contract/types';
import { SqlStorage } from '@internal/sql-contract/types';
import { sqliteCreateNamespace } from '@internal/target-sqlite/control';
import { applicationDomainOf } from '@repo/test-utils';

export const ALL_CLASSES: MigrationOperationPolicy = {
  allowedOperationClasses: ['additive', 'widening', 'destructive', 'data'],
};

export const integer: StorageColumn = {
  many: false,
  dataType: 'sqlite/integer',
  codecId: 'sqlite/integer@1',
  nullable: false,
};

function contractOf(
  name: string,
  tables: Parameters<typeof sqliteCreateNamespace>[0]['entries']['table'],
): Contract<SqlStorage> {
  return {
    target: 'sqlite',
    targetFamily: 'sql',
    profileHash: profileHash('recreate-table-postcheck-skip'),
    storage: new SqlStorage({
      storageHash: coreHash(name),
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: sqliteCreateNamespace({
          id: UNBOUND_NAMESPACE_ID,
          entries: { table: tables },
        }),
      },
    }),
    roots: {},
    domain: applicationDomainOf({ models: {} }),
    capabilities: {},
    extensions: {},
    meta: {},
  };
}

export function postContract(
  onDelete: ReferentialAction,
  extraColumns: Readonly<Record<string, StorageColumn>> = {},
): Contract<SqlStorage> {
  return contractOf(`post-${onDelete}-${Object.keys(extraColumns).join('-')}`, {
    User: {
      columns: { id: integer },
      primaryKey: { columns: ['id'] },
      uniques: [],
      indexes: [],
      foreignKeys: [],
    },
    Post: {
      columns: { id: integer, authorId: { ...integer, nullable: true }, ...extraColumns },
      primaryKey: { columns: ['id'] },
      uniques: [],
      indexes: [],
      foreignKeys: [
        {
          source: {
            namespaceId: asNamespaceId(UNBOUND_NAMESPACE_ID),
            tableName: 'Post',
            columns: ['authorId'],
          },
          target: {
            namespaceId: asNamespaceId(UNBOUND_NAMESPACE_ID),
            tableName: 'User',
            columns: ['id'],
          },
          onDelete,
        },
      ],
    },
  });
}

export function counterContract(autoincrement: boolean): Contract<SqlStorage> {
  return contractOf(`counter-${autoincrement}`, {
    Counter: {
      columns: {
        id: autoincrement
          ? { ...integer, default: { kind: 'function', expression: 'autoincrement()' } }
          : integer,
      },
      primaryKey: { columns: ['id'] },
      uniques: [],
      indexes: [],
      foreignKeys: [],
    },
  });
}
