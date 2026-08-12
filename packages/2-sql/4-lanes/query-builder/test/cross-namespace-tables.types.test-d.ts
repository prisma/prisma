import { expectTypeOf, test } from 'vitest';
import type { Contract } from '../../sql-builder/test/fixtures/generated/contract';
import { createRef, createRoot, type SelectBuilder } from '../src';
import type { UnboundTables } from '../src/selection';

declare const contract: Contract;
const ref = createRef(contract);
const root = createRoot(contract);

test('UnboundTables resolves tables from the public namespace (not __unbound__ only)', () => {
  type Tables = UnboundTables<Contract>;
  expectTypeOf<Tables['users']>().not.toBeNever();
  expectTypeOf<Tables['posts']>().not.toBeNever();
});

test('root.from keying accepts public-namespace table names', () => {
  type UsersFrom = SelectBuilder<Contract, Pick<UnboundTables<Contract>, 'users'>>;
  expectTypeOf<UsersFrom>().not.toBeNever();
});

test('table names absent from every namespace are rejected on ref', () => {
  // @ts-expect-error reference to a non-existing table in the contract
  ref.no_such_table;
});

test('root.from rejects table references outside the contract', () => {
  root
    // @ts-expect-error invalid table reference in previous root.from() call
    .from(ref.no_such_table)
    // @ts-expect-error invalid table reference in previous root.from() call
    .build();
});
