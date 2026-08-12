import type { PlanMeta } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
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
    | 'beforeExecute'
    | 'onRow'
    | 'afterExecute';
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

  async close(): Promise<void> {
    this.closeCalls++;
  }
}

function recorder(label: string, log: RecorderEntry[]): RuntimeMiddleware<MockExec> {
  return {
    name: label,
    async beforeExecute() {
      log.push({ stage: 'beforeExecute', label });
    },
    async onRow() {
      log.push({ stage: 'onRow', label });
    },
    async afterExecute() {
      log.push({ stage: 'afterExecute', label });
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
    const out = await runtime.execute(plan).toArray();

    expect(out).toEqual([{ id: 1 }]);
    expect([...runtime.events, ...log]).toEqual([
      { stage: 'runBeforeCompile' },
      { stage: 'lower' },
      { stage: 'runDriver' },
      { stage: 'beforeExecute', label: 'A' },
      { stage: 'onRow', label: 'A' },
      { stage: 'afterExecute', label: 'A' },
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
    await runtime.execute(plan).toArray();

    const middlewareOrder = log.map((e) => `${e.stage}:${e.label ?? ''}`);
    expect(middlewareOrder).toEqual([
      'beforeExecute:A',
      'beforeExecute:B',
      'beforeExecute:C',
      'onRow:A',
      'onRow:B',
      'onRow:C',
      'onRow:A',
      'onRow:B',
      'onRow:C',
      'afterExecute:A',
      'afterExecute:B',
      'afterExecute:C',
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
      async close(): Promise<void> {}
    }

    const runtime = new IdentityRuntime({ middleware: [], ctx });
    const plan: MockPlan = { draftId: 'd-3', meta };

    await runtime.execute(plan).toArray();

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
      async close(): Promise<void> {}
    }

    const observer: RuntimeMiddleware<MockExec> = {
      name: 'observer',
      async beforeExecute(exec) {
        seenByMiddleware.push(exec);
      },
    };

    const runtime = new ForwardingRuntime({ middleware: [observer], ctx });
    const plan: MockPlan = { draftId: 'd-4', meta };
    await runtime.execute(plan).toArray();

    expect(seenByMiddleware).toHaveLength(1);
    expect(seenByMiddleware[0]).toMatchObject({ compiledId: 'compiled:d-4' });
    expect(seenByDriver).toHaveLength(1);
    expect(seenByDriver[0]).toBe(seenByMiddleware[0]);
  });

  it('subclasses can implement close() and it is invoked', async () => {
    const runtime = new MockRuntime([], ctx, []);
    expect(runtime.closeCalls).toBe(0);
    await runtime.close();
    expect(runtime.closeCalls).toBe(1);
  });

  describe('planExecutionId', () => {
    interface Observation {
      readonly hook: 'beforeExecute' | 'afterExecute';
      readonly planExecutionId: string;
    }

    function observer(log: Observation[]): RuntimeMiddleware<MockExec> {
      return {
        name: 'observer',
        async beforeExecute(_plan, hookCtx) {
          log.push({ hook: 'beforeExecute', planExecutionId: hookCtx.planExecutionId });
        },
        async afterExecute(_plan, _result, hookCtx) {
          log.push({ hook: 'afterExecute', planExecutionId: hookCtx.planExecutionId });
        },
      };
    }

    it('assigns the same planExecutionId to beforeExecute and afterExecute within one execute call', async () => {
      const log: Observation[] = [];
      const runtime = new MockRuntime([observer(log)], ctx, [{ id: 1 }]);
      const plan: MockPlan = { draftId: 'one-execute', meta };

      await runtime.execute(plan).toArray();

      expect(log).toHaveLength(2);
      expect(log[0]?.hook).toBe('beforeExecute');
      expect(log[1]?.hook).toBe('afterExecute');
      expect(log[0]?.planExecutionId).toBeTypeOf('string');
      expect(log[0]?.planExecutionId).toBe(log[1]?.planExecutionId);
    });

    it('assigns distinct planExecutionIds to two executions of the same plan instance', async () => {
      const log: Observation[] = [];
      const runtime = new MockRuntime([observer(log)], ctx, [{ id: 1 }]);
      const plan: MockPlan = { draftId: 'shared-plan', meta };

      await runtime.execute(plan).toArray();
      await runtime.execute(plan).toArray();

      expect(log).toHaveLength(4);
      const firstExecId = log[0]?.planExecutionId;
      const secondExecId = log[2]?.planExecutionId;
      expect(firstExecId).toBeTypeOf('string');
      expect(secondExecId).toBeTypeOf('string');
      // Within each execute call, beforeExecute and afterExecute see the same ID.
      expect(log[0]?.planExecutionId).toBe(log[1]?.planExecutionId);
      expect(log[2]?.planExecutionId).toBe(log[3]?.planExecutionId);
      // Across execute calls, the IDs differ.
      expect(firstExecId).not.toBe(secondExecId);
    });
  });
});
