import type { PlanMeta } from '@internal/contract/types';
import { expectTypeOf, test } from 'vitest';
import type { ExecutionPlan, QueryPlan } from '../src/execution/query-plan';
import { RuntimeCore } from '../src/execution/runtime-core';
import type { RuntimeExecutor, RuntimeMiddleware } from '../src/execution/runtime-middleware';

interface FixturePlan extends QueryPlan {
  readonly draftId: string;
}
interface FixtureExec extends ExecutionPlan {
  readonly compiledId: string;
}

class FixtureRuntime extends RuntimeCore<FixturePlan, FixtureExec, RuntimeMiddleware<FixtureExec>> {
  protected lower(plan: FixturePlan): FixtureExec {
    return { compiledId: plan.draftId, meta: plan.meta };
  }
  protected runDriver(): AsyncIterable<Record<string, unknown>> {
    return {
      async *[Symbol.asyncIterator]() {},
    };
  }
  protected async runExecute(): Promise<{ affectedRows: number }> {
    return { affectedRows: 0 };
  }
  async close(): Promise<void> {}
}

const meta: PlanMeta = {
  target: 'mock',
  storageHash: 'test',
  lane: 'raw-sql',
};

test('query and execute accept an optional second argument carrying { signal }', () => {
  const runtime = new FixtureRuntime({
    middleware: [],
    ctx: {
      contract: {},
      mode: 'strict',
      now: () => 0,
      log: { info: () => {}, warn: () => {}, error: () => {} },
      contentHash: async () => 'mock-hash',
      scope: 'runtime',
      operation: 'query',
      planExecutionId: 'test-fixture-plan-execution-id',
    },
  });
  const plan: FixturePlan = { draftId: 'd', meta };
  // All three call shapes must compile.
  void runtime.query(plan);
  void runtime.query(plan, undefined);
  void runtime.query(plan, {});
  void runtime.query(plan, { signal: new AbortController().signal });
  void runtime.execute(plan);
  void runtime.execute(plan, undefined);
  void runtime.execute(plan, {});
  void runtime.execute(plan, { signal: new AbortController().signal });
});

test('RuntimeExecutor operations accept options arg', () => {
  type Executor = RuntimeExecutor<FixturePlan>;
  type QueryParams = Parameters<Executor['query']>;
  type ExecuteParams = Parameters<Executor['execute']>;
  expectTypeOf<QueryParams[1]>().toEqualTypeOf<
    | { readonly signal?: AbortSignal; readonly scope?: 'runtime' | 'connection' | 'transaction' }
    | undefined
  >();
  expectTypeOf<ExecuteParams[1]>().toEqualTypeOf<
    | { readonly signal?: AbortSignal; readonly scope?: 'runtime' | 'connection' | 'transaction' }
    | undefined
  >();
});
