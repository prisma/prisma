import type { Contract as ContractBase } from '@internal/contract/types';
import type { MongoCollection } from '@internal/mongo-contract';
import { expectTypeOf, test } from 'vitest';
import { MongoContractView } from '../src/core/ir/mongo-contract-view';
import type { Contract } from './fixtures/orm-contract.d';

/**
 * Emit-then-consume type tests: the `Contract` type is the real emitted
 * contract from `test/fixtures/orm-contract.d.ts`. All assertions check the
 * projected type against the actual emitted shape, not a hand-authored `typeof`.
 */

type CV = MongoContractView<Contract>;

test('the view is assignable to Contract (superset)', () => {
  expectTypeOf<CV>().toMatchTypeOf<ContractBase>();
});

test('from() and fromJson() both return the view type', () => {
  expectTypeOf(MongoContractView.from<Contract>).returns.toEqualTypeOf<CV>();
  expectTypeOf(MongoContractView.fromJson<Contract>).returns.toEqualTypeOf<CV>();
});

test('view.collection gives correctly typed built-in collection entities', () => {
  expectTypeOf<CV['collection']['tasks']>().toEqualTypeOf<MongoCollection>();
  expectTypeOf<CV['collection']['users']>().toEqualTypeOf<MongoCollection>();
});

test('view.namespace.__unbound__ reaches the default namespace by id', () => {
  expectTypeOf<
    CV['namespace']['__unbound__']['collection']['tasks']
  >().toEqualTypeOf<MongoCollection>();
});

test('a non-existent collection name is a compile error', () => {
  const view = null as unknown as CV;
  // @ts-expect-error 'nonexistent' does not exist on the collection map
  view.collection.nonexistent;
});

test('view.entries does not contain the collection key', () => {
  type Entries = CV['entries'];
  type HasCollection = 'collection' extends keyof Entries ? true : false;
  expectTypeOf<HasCollection>().toEqualTypeOf<false>();
});
