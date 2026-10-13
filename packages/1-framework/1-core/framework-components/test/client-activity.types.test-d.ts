import { expectTypeOf, test } from 'vitest';
import type { ClientActivityRun } from '../src/execution/client-activity';
import type {
  Activity,
  ActivityEndedResult,
  ClientActivity,
  ClientActivityKind,
  CrossFamilyMiddleware,
  RuntimeMiddleware,
  StatementActivity,
  TransactionActivity,
} from '../src/execution/runtime-middleware';
import { startCall } from './client-activity-fixtures';

test('the registered kinds are the client activity kinds', () => {
  expectTypeOf<ClientActivityKind>().toEqualTypeOf<'test-call' | 'test-count'>();
});

test('an activity narrows on a registered kind, and on statement and transaction', () => {
  const middleware: CrossFamilyMiddleware = {
    name: 'narrowing',
    async activityStarted(activity) {
      if (activity.kind === 'test-call') {
        expectTypeOf(activity).toEqualTypeOf<ClientActivity<'test-call'>>();
        expectTypeOf(activity.contentHash).toEqualTypeOf<string>();
      }
      if (activity.kind === 'statement') {
        expectTypeOf(activity).toEqualTypeOf<StatementActivity>();
      }
      if (activity.kind === 'transaction') {
        expectTypeOf(activity).toEqualTypeOf<TransactionActivity>();
      }
    },
  };
  void middleware;
});

test('Activity is the statement, the transaction and one client activity per kind', () => {
  expectTypeOf<Activity>().toEqualTypeOf<
    | StatementActivity
    | TransactionActivity
    | ClientActivity<'test-call'>
    | ClientActivity<'test-count'>
  >();
});

test('a client activity ended result carries the result type its kind registered', () => {
  const middleware: CrossFamilyMiddleware = {
    name: 'results',
    async activityEnded(_activity, result) {
      if (result.kind === 'test-count') {
        expectTypeOf(result.result).toEqualTypeOf<number | undefined>();
        expectTypeOf(result.source).toEqualTypeOf<'client' | 'middleware'>();
        expectTypeOf(result.outcome).toEqualTypeOf<'succeeded' | 'failed' | 'stopped'>();
      }
    },
  };
  void middleware;
  expectTypeOf<Extract<ActivityEndedResult, { kind: 'test-call' }>['result']>().toEqualTypeOf<
    ReadonlyArray<{ readonly id: number }> | undefined
  >();
});

test('a client activity run types its intercepted result and its end result by kind', async () => {
  const call = await startCall([], { kind: 'test-count' });
  expectTypeOf(call).toEqualTypeOf<ClientActivityRun<'test-count'>>();
  expectTypeOf(call.activity).toEqualTypeOf<ClientActivity<'test-count'>>();
  expectTypeOf(call.intercepted).toEqualTypeOf<{ readonly result: number } | undefined>();
  // @ts-expect-error - a test-count activity ends with a number
  await call.end({ outcome: 'succeeded', result: 'not a number' });
});

test('an unregistered kind does not compile', () => {
  // @ts-expect-error - 'orm-call' is not a registered kind
  void startCall([], { kind: 'orm-call' });
});

test('intercept.onActivity receives a client activity and returns an opaque result', () => {
  type OnActivity = NonNullable<NonNullable<RuntimeMiddleware['intercept']>['onActivity']>;
  expectTypeOf<Parameters<OnActivity>[0]>().toEqualTypeOf<ClientActivity>();
  expectTypeOf<ReturnType<OnActivity>>().toEqualTypeOf<
    Promise<{ readonly result: unknown } | undefined>
  >();
});
