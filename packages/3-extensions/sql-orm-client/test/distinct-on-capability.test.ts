import { soleDomainNamespaceId } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import { Collection } from '../src/collection';
import { baseContract, createCollectionFor } from './collection-fixtures';
import { createMockRuntime, getTestContext, withCapabilities } from './helpers';

// Mirrors the sql-builder lane's proof shape for the identical gate
// (`test/e2e/framework/test/sqlite/sql-builder.test.ts:345-352`): a
// contract without `postgres.distinctOn` makes the call a compile error
// (asserted with `@ts-expect-error`) and, if reached dynamically, a runtime
// error carrying `ORM.CAPABILITY_MISSING`.
describe('distinctOn() capability gate', () => {
  it('compiles and behaves unchanged when the contract declares postgres.distinctOn', () => {
    const { collection } = createCollectionFor('Post');
    const gated = collection.orderBy((post) => post.title.asc()).distinctOn('title');

    expect(gated).toBeInstanceOf(Collection);
  });

  it('is gated out at compile time and throws ORM.CAPABILITY_MISSING at runtime without postgres.distinctOn', () => {
    const contract = withCapabilities(baseContract, { sql: { defaultInInsert: true } });
    const context = { ...getTestContext(), contract };
    const runtime = createMockRuntime();
    const collection = new Collection({ runtime, context }, 'Post', {
      namespaceId: soleDomainNamespaceId(contract.domain),
    });

    const ordered = collection.orderBy((post) => post.title.asc());
    // @ts-expect-error distinctOn is gated out without postgres.distinctOn
    expect(() => ordered.distinctOn('title')).toThrow(
      'distinctOn() requires capability postgres.distinctOn',
    );
  });
});
