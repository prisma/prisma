import type { PlanMeta } from '@internal/contract/types';
import { assertType, expectTypeOf, test } from 'vitest';
import type { ExecutionPlan, QueryPlan } from '../src/execution/query-plan';
import type {
  InterceptResult,
  RuntimeExecutor,
  RuntimeMiddleware,
  RuntimeMiddlewareContext,
} from '../src/execution/runtime-middleware';

test('framework ExecutionPlan satisfies RuntimeExecutor plan constraint', () => {
  type Executor = RuntimeExecutor<ExecutionPlan>;
  expectTypeOf<Executor>().toHaveProperty('query');
  expectTypeOf<Executor>().toHaveProperty('execute');
  expectTypeOf<Executor>().toHaveProperty('close');
});

test('SQL-shaped plan satisfies RuntimeExecutor plan constraint', () => {
  interface SqlShapedPlan extends QueryPlan {
    readonly sql: string;
    readonly params: readonly unknown[];
  }
  type SqlExecutor = RuntimeExecutor<SqlShapedPlan>;
  expectTypeOf<SqlExecutor>().toHaveProperty('query');
  expectTypeOf<SqlExecutor>().toHaveProperty('execute');
  expectTypeOf<SqlExecutor>().toHaveProperty('close');
});

test('MongoQueryPlan-shaped type satisfies RuntimeExecutor plan constraint', () => {
  interface MongoLikePlan extends QueryPlan {
    readonly collection: string;
    readonly command: unknown;
  }
  type MongoExecutor = RuntimeExecutor<MongoLikePlan>;
  expectTypeOf<MongoExecutor>().toHaveProperty('query');
  expectTypeOf<MongoExecutor>().toHaveProperty('execute');
  expectTypeOf<MongoExecutor>().toHaveProperty('close');
});

test('type without meta does not satisfy plan constraint', () => {
  // @ts-expect-error - missing meta property required by QueryPlan
  type _Invalid = RuntimeExecutor<{ sql: string }>;
});

test('RuntimeMiddleware default plan parameter sees only QueryPlan fields', () => {
  const middleware: RuntimeMiddleware = {
    name: 'test',
    async beforeExecute(plan) {
      assertType<PlanMeta>(plan.meta);
    },
    async onRow(row, plan) {
      assertType<Record<string, unknown>>(row);
      assertType<PlanMeta>(plan.meta);
    },
    async afterExecute(plan, result) {
      assertType<PlanMeta>(plan.meta);
      assertType<number>(result.latencyMs);
      assertType<boolean>(result.completed);
      assertType<'driver' | 'middleware'>(result.source);
      if (result.operation === 'query') {
        assertType<number>(result.rowCount);
      } else if (result.completed) {
        assertType<number>(result.stats.affectedRows);
      }
    },
  };
  void middleware;
});

test('RuntimeMiddleware.intercept is optional', () => {
  // No `intercept` field — perfectly valid.
  const observer: RuntimeMiddleware = {
    name: 'observer',
    async beforeExecute() {},
  };
  void observer;
});

test('RuntimeMiddleware.intercept receives the plan and context, returns Promise<InterceptResult | undefined>', () => {
  const interceptor: RuntimeMiddleware = {
    name: 'interceptor',
    async intercept(plan, ctx) {
      assertType<PlanMeta>(plan.meta);
      assertType<RuntimeMiddlewareContext>(ctx);
      return undefined;
    },
  };
  void interceptor;

  // The hook's return type is exactly `Promise<InterceptResult | undefined>`.
  type InterceptHook = NonNullable<RuntimeMiddleware['intercept']>;
  expectTypeOf<ReturnType<InterceptHook>>().toEqualTypeOf<Promise<InterceptResult | undefined>>();
});

test('RuntimeMiddleware.intercept narrows the plan parameter alongside other hooks', () => {
  interface SqlExec extends ExecutionPlan {
    readonly sql: string;
    readonly params: readonly unknown[];
  }
  const middleware: RuntimeMiddleware<SqlExec> = {
    name: 'sql-interceptor',
    async intercept(plan) {
      assertType<string>(plan.sql);
      assertType<readonly unknown[]>(plan.params);
      return undefined;
    },
  };
  void middleware;
});

test('InterceptResult.rows accepts Iterable, AsyncIterable, and arrays', () => {
  // Array (which is also Iterable) — common case for cached rows.
  const fromArray: InterceptResult = {
    operation: 'query',
    rows: [{ id: 1 }, { id: 2 }],
  };
  void fromArray;

  // Sync generator (Iterable).
  function* syncGen(): Generator<Record<string, unknown>, void, unknown> {
    yield { id: 1 };
  }
  const fromSyncGen: InterceptResult = {
    operation: 'query',
    rows: syncGen(),
  };
  void fromSyncGen;

  // Async generator (AsyncIterable).
  async function* asyncGen(): AsyncGenerator<Record<string, unknown>, void, unknown> {
    yield { id: 1 };
  }
  const fromAsyncGen: InterceptResult = {
    operation: 'query',
    rows: asyncGen(),
  };
  void fromAsyncGen;
});

test('InterceptResult rejects rows whose elements are not Record<string, unknown>', () => {
  // @ts-expect-error - row elements must be Record<string, unknown>
  const _bad: InterceptResult = { operation: 'query', rows: [1, 2, 3] };
});

test('InterceptResult requires exactly one operation result shape', () => {
  const stats: InterceptResult = {
    operation: 'execute',
    stats: { affectedRows: 3 },
  };
  void stats;

  // @ts-expect-error - query results require rows
  const _queryWithoutRows: InterceptResult = { operation: 'query' };
  // @ts-expect-error - execute results require stats
  const _executeWithoutStats: InterceptResult = { operation: 'execute' };
  // @ts-expect-error - execute results cannot carry rows
  const _executeWithRows: InterceptResult = { operation: 'execute', rows: [] };
});

test('RuntimeMiddleware narrowed to a SQL plan sees the SQL fields', () => {
  interface SqlExec extends ExecutionPlan {
    readonly sql: string;
    readonly params: readonly unknown[];
  }
  const middleware: RuntimeMiddleware<SqlExec> = {
    name: 'sql-test',
    async beforeExecute(plan) {
      assertType<string>(plan.sql);
      assertType<readonly unknown[]>(plan.params);
    },
  };
  void middleware;
});

test('RuntimeMiddlewareContext has contract, mode, log, now, contentHash, scope, and operation', () => {
  expectTypeOf<RuntimeMiddlewareContext>().toHaveProperty('contract');
  expectTypeOf<RuntimeMiddlewareContext>().toHaveProperty('mode');
  expectTypeOf<RuntimeMiddlewareContext>().toHaveProperty('log');
  expectTypeOf<RuntimeMiddlewareContext>().toHaveProperty('now');
  expectTypeOf<RuntimeMiddlewareContext>().toHaveProperty('contentHash');
  expectTypeOf<RuntimeMiddlewareContext['contentHash']>().toBeFunction();
  expectTypeOf<RuntimeMiddlewareContext['contentHash']>().returns.resolves.toBeString();
  expectTypeOf<RuntimeMiddlewareContext>().toHaveProperty('scope');
  expectTypeOf<RuntimeMiddlewareContext['scope']>().toEqualTypeOf<
    'runtime' | 'connection' | 'transaction'
  >();
  expectTypeOf<RuntimeMiddlewareContext['operation']>().toEqualTypeOf<'query' | 'execute'>();
});

test('RuntimeMiddleware familyId and targetId are optional', () => {
  const generic: RuntimeMiddleware = { name: 'generic' };
  const familyBound: RuntimeMiddleware = { name: 'sql-only', familyId: 'sql' };
  const targetBound: RuntimeMiddleware = {
    name: 'pg-only',
    familyId: 'sql',
    targetId: 'postgres',
  };
  void generic;
  void familyBound;
  void targetBound;
});
