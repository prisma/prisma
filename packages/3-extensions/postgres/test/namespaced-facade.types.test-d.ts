import type { Db, Namespace, TableProxy } from '@internal/sql-builder/types';
import { expectTypeOf, test } from 'vitest';
import type { PostgresClient, PostgresTransactionContext } from '../src/runtime/postgres';
import type { Contract } from './fixtures/namespaced-contract';

declare const db: PostgresClient<Contract>;

type DbSql = PostgresClient<Contract>['sql'];
type DbOrm = PostgresClient<Contract>['orm'];

test('db.sql exposes the qualified namespace map', () => {
  expectTypeOf(db.sql.public.users).toEqualTypeOf<TableProxy<Contract, 'public', 'users'>>();
  expectTypeOf<Namespace<Contract, 'public'>['users']>().toEqualTypeOf<
    TableProxy<Contract, 'public', 'users'>
  >();
});

test('db.orm exposes the qualified namespace map', () => {
  expectTypeOf(db.orm.public.User).toHaveProperty('all');
});

test('transaction re-types sql/orm with the same qualified surface', () => {
  type TxSql = PostgresTransactionContext<Contract>['sql'];
  type TxOrm = PostgresTransactionContext<Contract>['orm'];
  expectTypeOf<TxSql>().toEqualTypeOf<DbSql>();
  expectTypeOf<TxOrm>().toEqualTypeOf<DbOrm>();

  db.transaction(async (tx) => {
    expectTypeOf(tx.sql.public.users).toEqualTypeOf<TableProxy<Contract, 'public', 'users'>>();
    expectTypeOf(tx.orm.public.User).toHaveProperty('all');
    return undefined;
  });
});

test('prepare callback receives the qualified sql surface', () => {
  type PrepareSql = Parameters<Parameters<PostgresClient<Contract>['prepare']>[1]>[0];
  expectTypeOf<PrepareSql>().toEqualTypeOf<Db<Contract>>();
  expectTypeOf<PrepareSql['public']['users']>().toEqualTypeOf<
    TableProxy<Contract, 'public', 'users'>
  >();
});
