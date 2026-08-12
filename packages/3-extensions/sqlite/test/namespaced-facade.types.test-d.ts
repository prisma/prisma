import type { Namespace, TableProxy } from '@internal/sql-builder/types';
import { expectTypeOf, test } from 'vitest';
import type { SqliteClient } from '../src/runtime/sqlite';
import type { Contract } from './fixtures/namespaced-contract';

declare const db: SqliteClient<Contract>;

test('db.sql exposes the flat surface via the unbound-namespace alias', () => {
  expectTypeOf(db.sql.users).toEqualTypeOf<TableProxy<Contract, '__unbound__', 'users'>>();
  expectTypeOf<Namespace<Contract, '__unbound__'>['users']>().toEqualTypeOf<
    TableProxy<Contract, '__unbound__', 'users'>
  >();
});

test('db.orm exposes the flat surface via the unbound-namespace alias', () => {
  expectTypeOf(db.orm.User).toHaveProperty('all');
});

test('an undeclared key is not on db.sql or db.orm', () => {
  // @ts-expect-error 'auth' is neither a table on the unbound sql facet
  db.sql.auth;
  // @ts-expect-error 'auth' is neither a model on the unbound orm facet
  db.orm.auth;
});

test('prepare callback receives the flat (unbound-facet) sql surface', () => {
  type PrepareSql = Parameters<Parameters<SqliteClient<Contract>['prepare']>[1]>[0];
  expectTypeOf<PrepareSql['users']>().toEqualTypeOf<TableProxy<Contract, '__unbound__', 'users'>>();
});
