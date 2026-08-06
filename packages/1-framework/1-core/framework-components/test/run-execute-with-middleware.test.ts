import type { PlanMeta } from '@internal/contract/types';
import { describe, expect, it, vi } from 'vitest';
import type { ExecutionPlan } from '../src/execution/query-plan';
import { runExecuteWithMiddleware, runWithMiddleware } from '../src/execution/run-with-middleware';
import type {
  AfterExecuteResult,
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
    operation: 'execute',
    planExecutionId: 'stats-execution',
  };
}

describe('runExecuteWithMiddleware', () => {
  it('returns driver statistics and reports successful completion', async () => {
    let observed: AfterExecuteResult | undefined;
    const middleware: RuntimeMiddleware<MockExec> = {
      name: 'observer',
      async afterExecute(_plan, result) {
        observed = result;
      },
    };

    await expect(
      runExecuteWithMiddleware(exec, [middleware], makeCtx(), async () => ({ affectedRows: 4 })),
    ).resolves.toEqual({ affectedRows: 4 });
    expect(observed).toMatchObject({
      operation: 'execute',
      completed: true,
      source: 'driver',
      stats: { affectedRows: 4 },
    });
    expect(observed?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns intercepted statistics without invoking the driver', async () => {
    const driver = vi.fn(async () => ({ affectedRows: 99 }));
    const middleware: RuntimeMiddleware<MockExec> = {
      name: 'interceptor',
      async intercept() {
        return { operation: 'execute', stats: { affectedRows: 7 } };
      },
    };

    await expect(runExecuteWithMiddleware(exec, [middleware], makeCtx(), driver)).resolves.toEqual({
      affectedRows: 7,
    });
    expect(driver).not.toHaveBeenCalled();
  });

  it('rejects a query-shaped intercept result instead of deriving statistics from rows', async () => {
    let observed: AfterExecuteResult | undefined;
    const middleware: RuntimeMiddleware<MockExec> = {
      name: 'wrong-result',
      async intercept() {
        return { operation: 'query', rows: [{ affectedRows: 100 }] };
      },
      async afterExecute(_plan, result) {
        observed = result;
      },
    };

    await expect(
      runExecuteWithMiddleware(exec, [middleware], makeCtx(), async () => ({ affectedRows: 1 })),
    ).rejects.toMatchObject({ code: 'RUNTIME.MIDDLEWARE_RESULT_MISMATCH' });
    expect(observed).toMatchObject({
      operation: 'execute',
      completed: false,
      source: 'middleware',
    });
    expect(observed).not.toHaveProperty('stats');
  });

  it('query execution rejects statistics-shaped intercept results', async () => {
    const middleware: RuntimeMiddleware<MockExec> = {
      name: 'wrong-result',
      async intercept() {
        return { operation: 'execute', stats: { affectedRows: 7 } };
      },
    };

    await expect(
      runWithMiddleware(
        exec,
        [middleware],
        { ...makeCtx(), operation: 'query' },
        async function* () {
          yield { id: 1 };
        },
      ).toArray(),
    ).rejects.toMatchObject({ code: 'RUNTIME.MIDDLEWARE_RESULT_MISMATCH' });
  });

  it('propagates a success-path afterExecute error without invoking completion twice', async () => {
    const afterError = new Error('afterExecute failed');
    const afterExecute = vi.fn(async () => {
      throw afterError;
    });
    const middleware: RuntimeMiddleware<MockExec> = {
      name: 'observer',
      afterExecute,
    };

    await expect(
      runExecuteWithMiddleware(exec, [middleware], makeCtx(), async () => ({ affectedRows: 1 })),
    ).rejects.toBe(afterError);
    expect(afterExecute).toHaveBeenCalledTimes(1);
  });

  it('preserves the original driver error when afterExecute also fails', async () => {
    const driverError = new Error('driver failed');
    const middleware: RuntimeMiddleware<MockExec> = {
      name: 'observer',
      async afterExecute() {
        throw new Error('afterExecute failed');
      },
    };

    await expect(
      runExecuteWithMiddleware(exec, [middleware], makeCtx(), async () => {
        throw driverError;
      }),
    ).rejects.toBe(driverError);
  });
});
