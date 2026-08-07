import type { PlanMeta } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import { runBeforeQueryChain } from '../src/execution/before-execute-chain';
import type { ExecutionPlan } from '../src/execution/query-plan';
import type {
  ParamRefMutator,
  RuntimeMiddleware,
  RuntimeMiddlewareContext,
} from '../src/execution/runtime-middleware';

const meta: PlanMeta = {
  target: 'mock',
  storageHash: 'test',
  lane: 'raw-sql',
};

interface MockExec extends ExecutionPlan {
  readonly id: string;
}

const mockExec: MockExec = { id: 'exec-1', meta };

function makeCtx(overrides?: Partial<RuntimeMiddlewareContext>): RuntimeMiddlewareContext {
  return {
    contract: {},
    mode: 'strict',
    now: () => Date.now(),
    log: { info: () => {}, warn: () => {}, error: () => {} },
    contentHash: async () => 'mock-hash',
    scope: 'runtime',
    operation: 'query',
    planExecutionId: 'test-fixture-plan-execution-id',
    ...overrides,
  };
}

describe('runBeforeQueryChain', () => {
  it('zero middleware resolves immediately', async () => {
    await expect(runBeforeQueryChain(mockExec, [], makeCtx())).resolves.toBeUndefined();
  });

  it('single middleware fires with (plan, ctx, mutator)', async () => {
    const events: Array<{
      plan: MockExec;
      ctx: RuntimeMiddlewareContext;
      mutator: ParamRefMutator | undefined;
    }> = [];
    const ctx = makeCtx();
    const mutator = {} as unknown as ParamRefMutator;

    const mw: RuntimeMiddleware<MockExec> = {
      name: 'observer',
      async beforeQuery(plan, mwCtx, params) {
        events.push({ plan, ctx: mwCtx, mutator: params });
      },
    };

    await runBeforeQueryChain<MockExec>(mockExec, [mw], ctx, mutator);

    expect(events).toHaveLength(1);
    expect(events[0]?.plan).toBe(mockExec);
    expect(events[0]?.ctx).toBe(ctx);
    expect(events[0]?.mutator).toBe(mutator);
  });

  it('runs every middleware in registration order', async () => {
    const events: string[] = [];

    function mw(label: string): RuntimeMiddleware<MockExec> {
      return {
        name: label,
        async beforeQuery() {
          events.push(label);
        },
      };
    }

    await runBeforeQueryChain<MockExec>(mockExec, [mw('A'), mw('B'), mw('C')], makeCtx());

    expect(events).toEqual(['A', 'B', 'C']);
  });

  it('skips middleware without a beforeQuery hook', async () => {
    const events: string[] = [];

    const a: RuntimeMiddleware<MockExec> = {
      name: 'A',
      async afterQuery() {
        events.push('A:afterQuery');
      },
    };
    const b: RuntimeMiddleware<MockExec> = {
      name: 'B',
      async beforeQuery() {
        events.push('B:beforeQuery');
      },
    };

    await runBeforeQueryChain<MockExec>(mockExec, [a, b], makeCtx());

    expect(events).toEqual(['B:beforeQuery']);
  });

  it('propagates errors thrown by a middleware body', async () => {
    const boom = new Error('beforeQuery boom');
    const mw: RuntimeMiddleware<MockExec> = {
      name: 'noisy',
      async beforeQuery() {
        throw boom;
      },
    };

    await expect(runBeforeQueryChain<MockExec>(mockExec, [mw], makeCtx())).rejects.toBe(boom);
  });

  it('short-circuits with RUNTIME.ABORTED when ctx.signal is already aborted at entry', async () => {
    const controller = new AbortController();
    controller.abort();

    const events: string[] = [];
    const mw: RuntimeMiddleware<MockExec> = {
      name: 'observer',
      async beforeQuery() {
        events.push('beforeQuery');
      },
    };

    await expect(
      runBeforeQueryChain<MockExec>(mockExec, [mw], makeCtx({ signal: controller.signal })),
    ).rejects.toMatchObject({
      name: 'RuntimeError',
      code: 'RUNTIME.ABORTED',
    });
    expect(events).toEqual([]);
  });

  it('races a long-running middleware body against ctx.signal — abort surfaces RUNTIME.ABORTED', async () => {
    const controller = new AbortController();
    const ctx = makeCtx({ signal: controller.signal });

    const mw: RuntimeMiddleware<MockExec> = {
      name: 'slow',
      async beforeQuery() {
        // Body ignores the signal and never resolves.
        await new Promise(() => {});
      },
    };

    const pending = runBeforeQueryChain<MockExec>(mockExec, [mw], ctx);
    queueMicrotask(() => controller.abort());

    await expect(pending).rejects.toMatchObject({
      name: 'RuntimeError',
      code: 'RUNTIME.ABORTED',
    });
  });

  it('threads the same params mutator into each middleware (mutations compose)', async () => {
    const observed: ParamRefMutator[] = [];
    const mutator = {} as unknown as ParamRefMutator;

    function mw(label: string): RuntimeMiddleware<MockExec> {
      return {
        name: label,
        async beforeQuery(_plan, _ctx, params) {
          if (params) observed.push(params);
        },
      };
    }

    await runBeforeQueryChain<MockExec>(mockExec, [mw('A'), mw('B')], makeCtx(), mutator);

    expect(observed).toHaveLength(2);
    expect(observed[0]).toBe(mutator);
    expect(observed[1]).toBe(mutator);
  });
});
