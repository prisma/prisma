import { profileHash, type StorageHashBase } from '@internal/contract/types';
import { SqlStorage, StorageTable } from '@internal/sql-contract/types';
import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../1-core/contract/test/test-support';
import { valueSetColumns } from '../src/core/migrations/value-set-columns';

const text = { dataType: 'test/text', codecId: 'test/text@1', nativeType: 'text', nullable: false };
const role = {
  ...text,
  valueSet: {
    plane: 'storage',
    namespaceId: 'app',
    entityKind: 'valueSet',
    entityName: 'Role',
  } as const,
};

function table(columns: Record<string, typeof text | typeof role>) {
  return new StorageTable({ columns, uniques: [], indexes: [], foreignKeys: [] });
}

describe('valueSetColumns', () => {
  it('lists each column whose values come from a value set, in every namespace', () => {
    const storage = new SqlStorage({
      storageHash: 'test' as StorageHashBase<string>,
      namespaces: {
        app: createTestSqlNamespace({
          id: 'app',
          entries: { table: { User: table({ id: text, role, name: text }) } },
        }),
        audit: createTestSqlNamespace({
          id: 'audit',
          entries: { table: { Entry: table({ kind: role }), Plain: table({ id: text }) } },
        }),
      },
    });
    expect(
      valueSetColumns({
        target: 'postgres',
        targetFamily: 'sql',
        profileHash: profileHash('test'),
        storage,
        domain: { namespaces: {} },
        roots: {},
        capabilities: {},
        extensions: {},
        meta: {},
      }),
    ).toEqual([
      { namespaceId: 'app', table: 'User', column: 'role' },
      { namespaceId: 'audit', table: 'Entry', column: 'kind' },
    ]);
  });
});
