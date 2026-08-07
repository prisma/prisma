import type { PlanMeta } from '@internal/contract/types';
import { describe, expect, it, vi } from 'vitest';
import type { ExecutionPlan } from '../src/execution/query-plan';
import {
  runExecuteWithMiddleware,
  runQueryWithMiddleware,
} from '../src/execution/run-with-middleware';
import type {
  AfterExecuteResult,
  AfterQueryResult,
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

const exec: MockExec = { id: 'exec-1', meta };

function makeCtx(): RuntimeMiddlewareContext {
  return {
    contract: {},
    mode: 'strict',
    now: () => Date.now(),
    log: { info: () => {}, warn: () => {}, error: () => {} },
    contentHash: async () => 'mock-hash',
    scope: 'runtime',
    planExecutionId: 'operation-execution',
  };
}

describe('operation-specific middleware runners', () => {
  it('uses the first query interceptor and reports middleware completion without onRow', async () => {
    const driver = vi.fn(async function* () {
      yield { id: 'driver' };
    });
    const calls: string[] = [];
    let completion: AfterQueryResult | undefined;
    const middleware: RuntimeMiddleware<MockExec>[] = [
      {
        name: 'passthrough',
        async interceptQuery() {
          calls.push('passthrough');
          return undefined;
        },
        async onRow() {
          calls.push('onRow');
        },
      },
      {
        name: 'winner',
        async interceptQuery() {
          calls.push('winner');
          return { rows: [{ id: 'middleware' }] };
        },
        async afterQuery(_plan, result) {
          completion = result;
        },
      },
      {
        name: 'tail',
        async interceptQuery() {
          calls.push('tail');
          return { rows: [] };
        },
      },
    ];

    await expect(
      runQueryWithMiddleware(exec, middleware, makeCtx(), driver).toArray(),
    ).resolves.toEqual([{ id: 'middleware' }]);
    expect(calls).toEqual(['passthrough', 'winner']);
    expect(driver).not.toHaveBeenCalled();
    expect(completion).toMatchObject({
      rowCount: 1,
      completed: true,
      source: 'middleware',
    });
    expect(completion).not.toHaveProperty('operation');
  });

  it('uses the first execute interceptor and reports its exact statistics', async () => {
    const driver = vi.fn(async () => ({ affectedRows: 99 }));
    const calls: string[] = [];
    let completion: AfterExecuteResult | undefined;
    const middleware: RuntimeMiddleware<MockExec>[] = [
      {
        name: 'passthrough',
        async interceptExecute() {
          calls.push('passthrough');
          return undefined;
        },
      },
      {
        name: 'winner',
        async interceptExecute() {
          calls.push('winner');
          return { stats: { affectedRows: 7 } };
        },
        async afterExecute(_plan, result) {
          completion = result;
        },
      },
      {
        name: 'tail',
        async interceptExecute() {
          calls.push('tail');
          return { stats: { affectedRows: 8 } };
        },
      },
    ];

    await expect(runExecuteWithMiddleware(exec, middleware, makeCtx(), driver)).resolves.toEqual({
      affectedRows: 7,
    });
    expect(calls).toEqual(['passthrough', 'winner']);
    expect(driver).not.toHaveBeenCalled();
    expect(completion).toMatchObject({
      stats: { affectedRows: 7 },
      completed: true,
      source: 'middleware',
    });
    expect(completion).not.toHaveProperty('operation');
  });

  it('reports driver success through only the matching completion hook', async () => {
    const afterQuery = vi.fn();
    const afterExecute = vi.fn();
    const middleware: RuntimeMiddleware<MockExec> = {
      name: 'observer',
      afterQuery,
      afterExecute,
    };

    await runQueryWithMiddleware(exec, [middleware], makeCtx(), async function* () {
      yield { id: 1 };
    }).toArray();
    expect(afterQuery).toHaveBeenCalledWith(
      exec,
      expect.objectContaining({ rowCount: 1, completed: true, source: 'driver' }),
      expect.any(Object),
    );
    expect(afterExecute).not.toHaveBeenCalled();

    afterQuery.mockClear();
    await runExecuteWithMiddleware(exec, [middleware], makeCtx(), async () => ({
      affectedRows: 4,
    }));
    expect(afterQuery).not.toHaveBeenCalled();
    expect(afterExecute).toHaveBeenCalledWith(
      exec,
      expect.objectContaining({
        stats: { affectedRows: 4 },
        completed: true,
        source: 'driver',
      }),
      expect.any(Object),
    );
  });

  it.each(['query', 'execute'] as const)(
    'preserves the original %s failure when its completion hook fails',
    async (operation) => {
      const original = new Error(`${operation} failed`);
      const afterError = new Error('completion failed');
      let completion: AfterQueryResult | AfterExecuteResult | undefined;
      const middleware: RuntimeMiddleware<MockExec> = {
        name: 'observer',
        async afterQuery(_plan, result) {
          completion = result;
          throw afterError;
        },
        async afterExecute(_plan, result) {
          completion = result;
          throw afterError;
        },
      };

      const pending =
        operation === 'query'
          ? runQueryWithMiddleware(exec, [middleware], makeCtx(), async function* () {
              yield* [];
              throw original;
            }).toArray()
          : runExecuteWithMiddleware(exec, [middleware], makeCtx(), async () => {
              throw original;
            });

      await expect(pending).rejects.toBe(original);
      expect(completion).toMatchObject({ completed: false, source: 'driver' });
      expect(completion).not.toHaveProperty('operation');
      if (operation === 'execute') {
        expect(completion).not.toHaveProperty('stats');
      }
    },
  );

  it.each(['query', 'execute'] as const)(
    'propagates a success-path %s completion error',
    async (operation) => {
      const afterError = new Error('completion failed');
      const middleware: RuntimeMiddleware<MockExec> = {
        name: 'observer',
        async afterQuery() {
          throw afterError;
        },
        async afterExecute() {
          throw afterError;
        },
      };

      const pending =
        operation === 'query'
          ? runQueryWithMiddleware(exec, [middleware], makeCtx(), async function* () {}).toArray()
          : runExecuteWithMiddleware(exec, [middleware], makeCtx(), async () => ({
              affectedRows: 1,
            }));
      await expect(pending).rejects.toBe(afterError);
    },
  );
});
