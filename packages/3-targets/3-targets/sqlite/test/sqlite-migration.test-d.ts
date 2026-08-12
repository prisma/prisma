import { expectTypeOf, test } from 'vitest';
import { SqliteMigration } from '../src/core/migrations/sqlite-migration';
import type { SqliteContractView } from '../src/core/sqlite-contract-view';
import type { Contract } from './fixtures/sqlite-contract.d';

/**
 * Emit-then-consume type tests: the migration's `endContract` getter resolves
 * to the precisely-typed `SqliteContractView<End>` over the real emitted SQLite
 * contract fixture.
 */

class TypedMigration extends SqliteMigration<Contract, Contract> {
  override readonly endContractJson = {} as Contract;
  override get operations() {
    return [];
  }
}

type EndView = TypedMigration['endContract'];
type StartView = TypedMigration['startContract'];

test('endContract is a SqliteContractView<Contract>', () => {
  expectTypeOf<EndView>().toEqualTypeOf<SqliteContractView<Contract>>();
});

test('startContract is SqliteContractView<Contract> | null', () => {
  expectTypeOf<StartView>().toEqualTypeOf<SqliteContractView<Contract> | null>();
});

test('endContract.table.<x> resolves to the concrete emitted table leaf', () => {
  expectTypeOf<
    EndView['table']['users']['columns']['id']['codecId']
  >().toEqualTypeOf<'sqlite/integer@1'>();
});

test('a non-existent table name on the view is a compile error', () => {
  const view = null as unknown as EndView;
  // @ts-expect-error 'nonexistent' is not an emitted table
  view.table.nonexistent;
});
