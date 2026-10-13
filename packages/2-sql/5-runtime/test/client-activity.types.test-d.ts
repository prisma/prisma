import type { ClientActivity } from '@internal/framework-components/runtime';
import { expectTypeOf, test } from 'vitest';
import type { ActivityHandle } from '../src/activity-handle';
import type {
  Runtime,
  RuntimeConnection,
  RuntimeTransaction,
  TransactionContext,
} from '../src/sql-runtime';
import './client-activity-kinds';

test('the runtime, its connections and its transactions start activities', () => {
  expectTypeOf<Runtime['startActivity']>().toBeFunction();
  expectTypeOf<RuntimeConnection['startActivity']>().toBeFunction();
  expectTypeOf<RuntimeTransaction['startActivity']>().toBeFunction();
  expectTypeOf<Runtime['planContentHash']>().returns.resolves.toBeString();
});

test('the context of withTransaction does not show startActivity or planContentHash', () => {
  expectTypeOf<TransactionContext>().not.toHaveProperty('startActivity');
  expectTypeOf<TransactionContext>().not.toHaveProperty('planContentHash');
});

test('a handle is typed by its kind', async () => {
  const runtime = {} as Runtime;
  const call = await runtime.startActivity({ kind: 'test-call', contentHash: 'hash' });
  expectTypeOf(call).toEqualTypeOf<ActivityHandle<'test-call'>>();
  expectTypeOf(call.activity).toEqualTypeOf<ClientActivity<'test-call'>>();
  expectTypeOf(call.intercepted).toEqualTypeOf<
    { readonly result: ReadonlyArray<{ readonly id: number }> } | undefined
  >();
  expectTypeOf(call.transaction).toEqualTypeOf<(() => Promise<RuntimeTransaction>) | undefined>();
  // @ts-expect-error - 'orm-call' is not a registered kind
  void runtime.startActivity({ kind: 'orm-call', contentHash: 'hash' });
});
