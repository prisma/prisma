import type { Collection } from '@internal/sql-orm-client';
import { expectTypeOf, test } from 'vitest';
import type { RoleBoundDb, SupabaseTransactionContext } from '../src/exports/runtime';
import type { Contract } from './fixtures/example-app/contract';

declare class ProfileCollection extends Collection<Contract, 'Profile'> {
  named(username: string): this;
}
type Classes = { Profile: typeof ProfileCollection };
type Client = RoleBoundDb<Contract, Classes>;
type Tx = SupabaseTransactionContext<Contract, Classes>;

test('a role-bound transaction receives the transaction context', () => {
  expectTypeOf<Parameters<Parameters<Client['transaction']>[0]>[0]>().toEqualTypeOf<Tx>();
});

test('each query member of a transaction has the type it has on the role-bound client', () => {
  expectTypeOf<Tx['sql']>().toEqualTypeOf<Client['sql']>();
  expectTypeOf<Tx['orm']>().toEqualTypeOf<Client['orm']>();
  expectTypeOf<Tx['raw']>().toEqualTypeOf<Client['raw']>();
  expectTypeOf<Tx['prepare']>().toEqualTypeOf<Client['prepare']>();
  expectTypeOf<Tx['orm']['public']['Profile']['named']>().toBeFunction();
});

test('a transaction has no lifecycle members, transaction or runtime', () => {
  expectTypeOf<
    Extract<keyof Tx, 'close' | 'transaction' | 'runtime' | typeof Symbol.asyncDispose>
  >().toBeNever();
});
