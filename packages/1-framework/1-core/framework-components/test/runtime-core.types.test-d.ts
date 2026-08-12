import type { PlanMeta } from '@internal/contract/types';
import { expectTypeOf, test } from 'vitest';
import type { AsyncIterableResult } from '../src/execution/async-iterable-result';
import type { ExecutionPlan, QueryPlan } from '../src/execution/query-plan';
import { RuntimeCore } from '../src/execution/runtime-core';
import type { RuntimeExecutor, RuntimeMiddleware } from '../src/execution/runtime-middleware';

interface FixturePlan extends QueryPlan {
  readonly draftId: string;
}

interface FixtureExec extends ExecutionPlan {
  readonly compiledId: string;
}

class MinimalRuntime extends RuntimeCore<FixturePlan, FixtureExec, RuntimeMiddleware<FixtureExec>> {
  protected lower(plan: FixturePlan): FixtureExec {
    return { compiledId: plan.draftId, meta: plan.meta };
  }
  protected runDriver(): AsyncIterable<Record<string, unknown>> {
    return {
      async *[Symbol.asyncIterator]() {},
    };
  }
  async close(): Promise<void> {}
}

test('a minimal RuntimeCore subclass typechecks', () => {
  expectTypeOf<typeof MinimalRuntime>().toBeConstructibleWith({
    middleware: [],
    ctx: {
      contract: {},
      mode: 'strict',
      now: () => 0,
      log: { info: () => {}, warn: () => {}, error: () => {} },
      contentHash: async () => 'mock-hash',
      scope: 'runtime',
      planExecutionId: 'test-fixture-plan-execution-id',
    },
  });
});

test('RuntimeCore is a RuntimeExecutor of TPlan', () => {
  expectTypeOf<MinimalRuntime>().toExtend<RuntimeExecutor<FixturePlan>>();
});

test('execute(plan) enforces the TPlan constraint and returns AsyncIterableResult<Row>', () => {
  const meta: PlanMeta = {
    target: 'mock',
    storageHash: 'test',
    lane: 'raw-sql',
  };
  type Row = { id: number };
  const plan: FixturePlan & { readonly _row?: Row } = { draftId: 'd', meta };
  const runtime: MinimalRuntime = new MinimalRuntime({
    middleware: [],
    ctx: {
      contract: {},
      mode: 'strict',
      now: () => 0,
      log: { info: () => {}, warn: () => {}, error: () => {} },
      contentHash: async () => 'mock-hash',
      scope: 'runtime',
      planExecutionId: 'test-fixture-plan-execution-id',
    },
  });
  const result = runtime.execute(plan);
  expectTypeOf(result).toEqualTypeOf<AsyncIterableResult<Row>>();
});

test('a subclass cannot declare lower returning a non-TExec type', () => {
  class WrongLowerRuntime extends RuntimeCore<
    FixturePlan,
    FixtureExec,
    RuntimeMiddleware<FixtureExec>
  > {
    // @ts-expect-error - lower must return FixtureExec | Promise<FixtureExec>
    protected lower(_plan: FixturePlan): { wrong: true } {
      return { wrong: true };
    }
    protected runDriver(): AsyncIterable<Record<string, unknown>> {
      return {
        async *[Symbol.asyncIterator]() {},
      };
    }
    async close(): Promise<void> {}
  }
  void WrongLowerRuntime;
});
