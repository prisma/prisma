import { expectTypeOf, test } from 'vitest';
import { PostgresMigration } from '../src/core/migrations/postgres-migration';
import type { PostgresContractView } from '../src/core/postgres-contract-view';
import type { Contract } from './fixtures/namespaced-contract.d';

/**
 * Emit-then-consume type tests: the migration's `endContract` getter resolves
 * to the precisely-typed, schema-qualified `PostgresContractView<End>` over the
 * real emitted multi-schema fixture.
 */

class TypedMigration extends PostgresMigration<Contract, Contract> {
  override readonly endContractJson = {} as Contract;
  override get operations() {
    return [];
  }
}

type EndView = TypedMigration['endContract'];
type StartView = TypedMigration['startContract'];

test('endContract is a PostgresContractView<Contract>', () => {
  expectTypeOf<EndView>().toEqualTypeOf<PostgresContractView<Contract>>();
});

test('startContract is PostgresContractView<Contract> | null', () => {
  expectTypeOf<StartView>().toEqualTypeOf<PostgresContractView<Contract> | null>();
});

test('endContract.namespace.<schema>.table.<x> resolves per-schema leaves', () => {
  expectTypeOf<
    EndView['namespace']['public']['table']['users']['columns']['email']['codecId']
  >().toEqualTypeOf<'pg/text@1'>();
  expectTypeOf<
    EndView['namespace']['auth']['table']['users']['columns']['token']['codecId']
  >().toEqualTypeOf<'pg/text@1'>();
});

test('cross-schema column access on the migration view is a compile error', () => {
  const view = null as unknown as EndView;
  // @ts-expect-error public.users has no `token` column (that is auth.users)
  view.namespace.public.table.users.columns.token;
});
