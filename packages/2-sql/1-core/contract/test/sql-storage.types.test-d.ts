import type { StorageHashBase } from '@internal/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { expectTypeOf, test } from 'vitest';
import { type SqlNamespace, SqlStorage } from '../src/ir/sql-storage';
import { createTestSqlNamespace } from './test-support';

const publicNs = createTestSqlNamespace({ id: 'public', entries: { table: {} } });
const unboundNs = createTestSqlNamespace({ id: UNBOUND_NAMESPACE_ID, entries: { table: {} } });

test('SqlStorage accepts namespaces with only a public key (no __unbound__)', () => {
  const storage = new SqlStorage({
    storageHash: 'test' as StorageHashBase<string>,
    namespaces: { public: publicNs },
  });
  expectTypeOf(storage.namespaces).toExtend<Readonly<Record<string, SqlNamespace>>>();
});

test('SqlStorage still accepts namespaces with only an __unbound__ key', () => {
  const storage = new SqlStorage({
    storageHash: 'test' as StorageHashBase<string>,
    namespaces: { [UNBOUND_NAMESPACE_ID]: unboundNs },
  });
  expectTypeOf(storage.namespaces).toExtend<Readonly<Record<string, SqlNamespace>>>();
});
