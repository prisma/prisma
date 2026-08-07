import type { PlanMeta } from '@internal/contract/types';
import { describe, expect, it, vi } from 'vitest';
import type { ExecutionPlan, QueryPlan } from '../src/execution/query-plan';
import { RuntimeCore } from '../src/execution/runtime-core';
import type {
  RuntimeMiddleware,
  RuntimeMiddlewareContext,
} from '../src/execution/runtime-middleware';

const meta: PlanMeta = {
  target: 'mock',
  storageHash: 'test',
  lane: 'raw-sql',
};

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

interface MockPlan<Row = Record<string, unknown>> extends QueryPlan<Row> {
  readonly draftId: string;
}

interface MockExec<Row = Record<string, unknown>> extends ExecutionPlan<Row> {
  readonly compiledId: string;
}

interface RecorderEntry {
  readonly stage:
    | 'runBeforeCompile'
    | 'lower'
    | 'runDriver'
    | 'runExecute'
    | 'beforeQuery'
    | 'onRow'
    | 'afterQuery';
  readonly label?: string;
}

class MockRuntime extends RuntimeCore<MockPlan, MockExec, RuntimeMiddleware<MockExec>> {
  readonly events: RecorderEntry[] = [];
  closeCalls = 0;

  constructor(
    middleware: ReadonlyArray<RuntimeMiddleware<MockExec>>,
    ctx: RuntimeMiddlewareContext,
    private readonly rows: ReadonlyArray<Record<string, unknown>>,
  ) {
    super({ middleware, ctx });
  }

  protected override runBeforeCompile(plan: MockPlan): MockPlan {
    this.events.push({ stage: 'runBeforeCompile' });
    return plan;
  }

  protected lower(plan: MockPlan): MockExec {
    this.events.push({ stage: 'lower' });
    return { compiledId: plan.draftId, meta: plan.meta };
  }

  protected runDriver(_exec: MockExec): AsyncIterable<Record<string, unknown>> {
    this.events.push({ stage: 'runDriver' });
    const rows = this.rows;
    const iter = {
      async *[Symbol.asyncIterator](): AsyncIterator<Record<string, unknown>> {
        for (const row of rows) {
          yield row;
        }
      },
    };
    return iter;
  }

  protected async runExecute(_exec: MockExec): Promise<{ affectedRows: number }> {
    this.events.push({ stage: 'runExecute' });
    return { affectedRows: 3 };
  }

  async close(): Promise<void> {
    this.closeCalls++;
  }
}

function recorder(label: string, log: RecorderEntry[]): RuntimeMiddleware<MockExec> {
  return {
    name: label,
    async beforeQuery() {
      log.push({ stage: 'beforeQuery', label });
    },
    async onRow() {
      log.push({ stage: 'onRow', label });
    },
    async afterQuery() {
      log.push({ stage: 'afterQuery', label });
    },
  };
}

const ctx: RuntimeMiddlewareContext = {
  contract: {},
  mode: 'strict',
  now: () => Date.now(),
  log: { info: () => {}, warn: () => {}, error: () => {} },
  contentHash: async () => 'mock-hash',
  scope: 'runtime',
  planExecutionId: 'test-fixture-plan-execution-id',
};

describe('RuntimeCore', () => {
  it('executes the lifecycle in order with a single middleware', async () => {
    const log: RecorderEntry[] = [];
    const runtime = new MockRuntime([recorder('A', log)], ctx, [{ id: 1 }]);

    const plan: MockPlan = { draftId: 'd-1', meta };
    const out = await runtime.query(plan).toArray();

    expect(out).toEqual([{ id: 1 }]);
    expect([...runtime.events, ...log]).toEqual([
      { stage: 'runBeforeCompile' },
      { stage: 'lower' },
      { stage: 'runDriver' },
      { stage: 'beforeQuery', label: 'A' },
      { stage: 'onRow', label: 'A' },
      { stage: 'afterQuery', label: 'A' },
    ]);
  });

  it('preserves middleware registration order at every hook site', async () => {
    const log: RecorderEntry[] = [];
    const runtime = new MockRuntime(
      [recorder('A', log), recorder('B', log), recorder('C', log)],
      ctx,
      [{ id: 1 }, { id: 2 }],
    );

    const plan: MockPlan = { draftId: 'd-2', meta };
    await runtime.query(plan).toArray();

    const middlewareOrder = log.map((e) => `${e.stage}:${e.label ?? ''}`);
    expect(middlewareOrder).toEqual([
      'beforeQuery:A',
      'beforeQuery:B',
      'beforeQuery:C',
      'onRow:A',
      'onRow:B',
      'onRow:C',
      'onRow:A',
      'onRow:B',
      'onRow:C',
      'afterQuery:A',
      'afterQuery:B',
      'afterQuery:C',
    ]);
  });

  it('runBeforeCompile defaults to identity (does not transform the plan)', async () => {
    class IdentityRuntime extends RuntimeCore<MockPlan, MockExec, RuntimeMiddleware<MockExec>> {
      observed: MockPlan | undefined;
      protected override runBeforeCompile(plan: MockPlan): MockPlan {
        this.observed = plan;
        return plan;
      }
      protected lower(plan: MockPlan): MockExec {
        return { compiledId: plan.draftId, meta: plan.meta };
      }
      protected runDriver(): AsyncIterable<Record<string, unknown>> {
        return {
          async *[Symbol.asyncIterator](): AsyncIterator<Record<string, unknown>> {},
        };
      }
      protected async runExecute(): Promise<{ affectedRows: number }> {
        return { affectedRows: 0 };
      }
      async close(): Promise<void> {}
    }

    const runtime = new IdentityRuntime({ middleware: [], ctx });
    const plan: MockPlan = { draftId: 'd-3', meta };

    await runtime.query(plan).toArray();

    expect(runtime.observed).toBe(plan);
  });

  it('forwards the lowered exec to runDriver and to middleware hooks', async () => {
    const seenByMiddleware: MockExec[] = [];
    const seenByDriver: MockExec[] = [];

    class ForwardingRuntime extends RuntimeCore<MockPlan, MockExec, RuntimeMiddleware<MockExec>> {
      protected lower(plan: MockPlan): MockExec {
        return { compiledId: `compiled:${plan.draftId}`, meta: plan.meta };
      }
      protected runDriver(exec: MockExec): AsyncIterable<Record<string, unknown>> {
        seenByDriver.push(exec);
        return {
          async *[Symbol.asyncIterator](): AsyncIterator<Record<string, unknown>> {
            yield { ok: true };
          },
        };
      }
      protected async runExecute(): Promise<{ affectedRows: number }> {
        return { affectedRows: 0 };
      }
      async close(): Promise<void> {}
    }

    const observer: RuntimeMiddleware<MockExec> = {
      name: 'observer',
      async beforeQuery(exec) {
        seenByMiddleware.push(exec);
      },
    };

    const runtime = new ForwardingRuntime({ middleware: [observer], ctx });
    const plan: MockPlan = { draftId: 'd-4', meta };
    await runtime.query(plan).toArray();

    expect(seenByMiddleware).toHaveLength(1);
    expect(seenByMiddleware[0]).toMatchObject({ compiledId: 'compiled:d-4' });
    expect(seenByDriver).toHaveLength(1);
    expect(seenByDriver[0]).toBe(seenByMiddleware[0]);
  });

  it('executes statistics through only the execute lifecycle', async () => {
    const hooks: string[] = [];
    const middleware: RuntimeMiddleware<MockExec> = {
      name: 'observer',
      async beforeQuery() {
        hooks.push('beforeQuery');
      },
      async interceptQuery() {
        hooks.push('interceptQuery');
        return undefined;
      },
      async afterQuery() {
        hooks.push('afterQuery');
      },
      async beforeExecute() {
        hooks.push('beforeExecute');
      },
      async interceptExecute() {
        hooks.push('interceptExecute');
        return undefined;
      },
      async afterExecute() {
        hooks.push('afterExecute');
      },
    };
    const runtime = new MockRuntime([middleware], ctx, [{ id: 'not-a-statistic' }]);

    await expect(runtime.execute({ draftId: 'stats', meta })).resolves.toEqual({
      affectedRows: 3,
    });

    expect(runtime.events).toEqual([
      { stage: 'runBeforeCompile' },
      { stage: 'lower' },
      { stage: 'runExecute' },
    ]);
    expect(hooks).toEqual(['beforeExecute', 'interceptExecute', 'afterExecute']);
  });

  it.each(['query', 'execute'] as const)(
    'does not invoke completion after a %s before-hook failure',
    async (operation) => {
      const beforeError = new Error('before failed');
      const afterQuery = vi.fn();
      const afterExecute = vi.fn();
      const middleware: RuntimeMiddleware<MockExec> = {
        name: 'observer',
        beforeQuery() {
          throw beforeError;
        },
        beforeExecute() {
          throw beforeError;
        },
        afterQuery,
        afterExecute,
      };
      const runtime = new MockRuntime([middleware], ctx, []);
      const plan: MockPlan = { draftId: 'before-failure', meta };

      const pending = operation === 'query' ? runtime.query(plan).toArray() : runtime.execute(plan);
      await expect(pending).rejects.toBe(beforeError);
      expect(afterQuery).not.toHaveBeenCalled();
      expect(afterExecute).not.toHaveBeenCalled();
    },
  );

  it('subclasses can implement close() and it is invoked', async () => {
    const runtime = new MockRuntime([], ctx, []);
    expect(runtime.closeCalls).toBe(0);
    await runtime.close();
    expect(runtime.closeCalls).toBe(1);
  });

  describe('signal propagation', () => {
    it('exposes the query signal by identity to every middleware hook', async () => {
      const controller = new AbortController();
      const observed: AbortSignal[] = [];
      const middleware: RuntimeMiddleware<MockExec> = {
        name: 'signal-observer',
        beforeQuery(_plan, hookCtx) {
          if (hookCtx.signal) observed.push(hookCtx.signal);
        },
        async interceptQuery(_plan, hookCtx) {
          if (hookCtx.signal) observed.push(hookCtx.signal);
          return undefined;
        },
        async onRow(_row, _plan, hookCtx) {
          if (hookCtx.signal) observed.push(hookCtx.signal);
        },
        async afterQuery(_plan, _result, hookCtx) {
          if (hookCtx.signal) observed.push(hookCtx.signal);
        },
      };
      const runtime = new MockRuntime([middleware], ctx, [{ id: 1 }]);

      await runtime
        .query({ draftId: 'query-signal', meta }, { signal: controller.signal })
        .toArray();

      expect(observed).toEqual([
        controller.signal,
        controller.signal,
        controller.signal,
        controller.signal,
      ]);
    });

    it('omits signal when a query supplies no options', async () => {
      const observed: boolean[] = [];
      const middleware: RuntimeMiddleware<MockExec> = {
        name: 'signal-observer',
        beforeQuery(_plan, hookCtx) {
          observed.push('signal' in hookCtx);
        },
      };
      const runtime = new MockRuntime([middleware], ctx, []);

      await runtime.query({ draftId: 'query-without-signal', meta }).toArray();

      expect(observed).toEqual([false]);
    });

    it('aborts an in-flight query beforeQuery hook', async () => {
      const controller = new AbortController();
      const entered = deferred();
      const middleware: RuntimeMiddleware<MockExec> = {
        name: 'blocking-before-execute',
        beforeQuery() {
          entered.resolve();
          return new Promise<void>(() => {});
        },
      };
      const runtime = new MockRuntime([middleware], ctx, []);
      const pending = runtime
        .query({ draftId: 'query-abort', meta }, { signal: controller.signal })
        .toArray();

      await entered.promise;
      controller.abort(new Error('query cancelled'));

      await expect(pending).rejects.toMatchObject({
        code: 'RUNTIME.ABORTED',
        details: { phase: 'beforeQuery' },
        cause: controller.signal.reason,
      });
    });
  });

  describe('planExecutionId', () => {
    interface Observation {
      readonly hook: 'beforeQuery' | 'afterQuery';
      readonly planExecutionId: string;
    }

    function observer(log: Observation[]): RuntimeMiddleware<MockExec> {
      return {
        name: 'observer',
        async beforeQuery(_plan, hookCtx) {
          log.push({ hook: 'beforeQuery', planExecutionId: hookCtx.planExecutionId });
        },
        async afterQuery(_plan, _result, hookCtx) {
          log.push({ hook: 'afterQuery', planExecutionId: hookCtx.planExecutionId });
        },
      };
    }

    it('assigns the same planExecutionId to beforeQuery and afterQuery within one query call', async () => {
      const log: Observation[] = [];
      const runtime = new MockRuntime([observer(log)], ctx, [{ id: 1 }]);
      const plan: MockPlan = { draftId: 'one-execute', meta };

      await runtime.query(plan).toArray();

      expect(log).toHaveLength(2);
      expect(log[0]?.hook).toBe('beforeQuery');
      expect(log[1]?.hook).toBe('afterQuery');
      expect(log[0]?.planExecutionId).toBeTypeOf('string');
      expect(log[0]?.planExecutionId).toBe(log[1]?.planExecutionId);
    });

    it('assigns distinct planExecutionIds to two queries of the same plan instance', async () => {
      const log: Observation[] = [];
      const runtime = new MockRuntime([observer(log)], ctx, [{ id: 1 }]);
      const plan: MockPlan = { draftId: 'shared-plan', meta };

      await runtime.query(plan).toArray();
      await runtime.query(plan).toArray();

      expect(log).toHaveLength(4);
      const firstQueryId = log[0]?.planExecutionId;
      const secondQueryId = log[2]?.planExecutionId;
      expect(firstQueryId).toBeTypeOf('string');
      expect(secondQueryId).toBeTypeOf('string');
      expect(log[0]?.planExecutionId).toBe(log[1]?.planExecutionId);
      expect(log[2]?.planExecutionId).toBe(log[3]?.planExecutionId);
      expect(firstQueryId).not.toBe(secondQueryId);
    });
  });
});
