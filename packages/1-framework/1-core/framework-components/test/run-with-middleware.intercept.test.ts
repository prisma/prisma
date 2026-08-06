import type { PlanMeta } from '@internal/contract/types';
import { describe, expect, it, vi } from 'vitest';
import type { ExecutionPlan } from '../src/execution/query-plan';
import { runWithMiddleware } from '../src/execution/run-with-middleware';
import type {
  AfterExecuteResult,
  InterceptResult,
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

async function* yieldRows<R>(rows: ReadonlyArray<R>): AsyncGenerator<R, void, unknown> {
  for (const row of rows) {
    yield row;
  }
}

describe('runWithMiddleware — intercept', () => {
  describe('chain semantics', () => {
    it('first interceptor returning a non-undefined result wins; subsequent intercept does not fire', async () => {
      const interceptCalls: string[] = [];
      const winnerRows = [{ id: 'a' }, { id: 'b' }];

      const winner: RuntimeMiddleware<MockExec> = {
        name: 'winner',
        async intercept() {
          interceptCalls.push('winner');
          return { operation: 'query', rows: winnerRows };
        },
      };
      const loser: RuntimeMiddleware<MockExec> = {
        name: 'loser',
        async intercept() {
          interceptCalls.push('loser');
          return { operation: 'query', rows: [{ id: 'should-not-appear' }] };
        },
      };

      const driverFactory = vi.fn(() => yieldRows([{ id: 'driver' }]));

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [winner, loser],
        makeCtx(),
        driverFactory,
      );

      const out = await result.toArray();

      expect(out).toEqual(winnerRows);
      expect(interceptCalls).toEqual(['winner']);
      expect(driverFactory).not.toHaveBeenCalled();
    });

    it('passes through to subsequent middleware when intercept returns undefined', async () => {
      const interceptCalls: string[] = [];
      const winnerRows = [{ id: 'B-served' }];

      const a: RuntimeMiddleware<MockExec> = {
        name: 'A',
        async intercept() {
          interceptCalls.push('A');
          return undefined;
        },
      };
      const b: RuntimeMiddleware<MockExec> = {
        name: 'B',
        async intercept() {
          interceptCalls.push('B');
          return { operation: 'query', rows: winnerRows };
        },
      };

      const driverFactory = vi.fn(() => yieldRows([{ id: 'driver' }]));

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [a, b],
        makeCtx(),
        driverFactory,
      );

      const out = await result.toArray();

      expect(out).toEqual(winnerRows);
      expect(interceptCalls).toEqual(['A', 'B']);
      expect(driverFactory).not.toHaveBeenCalled();
    });

    it('mixed chain: A is observer-only, B intercepts → driver is skipped; intercept + afterExecute fire', async () => {
      const events: string[] = [];

      const a: RuntimeMiddleware<MockExec> = {
        name: 'A',
        // `beforeExecute` is fired by the family runtime via
        // `runBeforeExecuteChain` before `runWithMiddleware` is
        // even reached; it is therefore not visible to interceptors.
        // See `before-execute-chain.test.ts`.
        async afterExecute() {
          events.push('A:afterExecute');
        },
      };
      const b: RuntimeMiddleware<MockExec> = {
        name: 'B',
        async intercept() {
          events.push('B:intercept');
          return { operation: 'query', rows: [{ id: 1 }] };
        },
        async afterExecute() {
          events.push('B:afterExecute');
        },
      };

      const driverFactory = vi.fn(() => yieldRows([{ id: 'driver' }]));

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [a, b],
        makeCtx(),
        driverFactory,
      );

      await result.toArray();

      expect(events).toEqual(['B:intercept', 'A:afterExecute', 'B:afterExecute']);
      expect(driverFactory).not.toHaveBeenCalled();
    });
  });

  describe('hit path', () => {
    it('skips onRow; afterExecute fires with source: "middleware"', async () => {
      const events: string[] = [];
      let observedResult: AfterExecuteResult | undefined;

      // `beforeExecute` is fired by the family runtime via
      // `runBeforeExecuteChain` before `runWithMiddleware`; it is not
      // visible at the intercept-vs-driver decision point. Asserted in
      // `before-execute-chain.test.ts`.
      const interceptor: RuntimeMiddleware<MockExec> = {
        name: 'interceptor',
        async intercept() {
          events.push('intercept');
          return { operation: 'query', rows: [{ id: 1 }, { id: 2 }, { id: 3 }] };
        },
        async onRow() {
          events.push('onRow');
        },
        async afterExecute(_plan, result) {
          observedResult = result;
          events.push('afterExecute');
        },
      };

      const driverFactory = vi.fn(() => yieldRows([{ id: 'driver' }]));

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [interceptor],
        makeCtx(),
        driverFactory,
      );

      const out = await result.toArray();

      expect(out).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(events).toEqual(['intercept', 'afterExecute']);
      expect(driverFactory).not.toHaveBeenCalled();
      expect(observedResult).toMatchObject({
        operation: 'query',
        rowCount: 3,
        completed: true,
        source: 'middleware',
      });
      expect(observedResult?.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('emits a middleware.intercept debug log event naming the winning middleware', async () => {
      const debug = vi.fn();
      const ctx = makeCtx({
        log: { info: () => {}, warn: () => {}, error: () => {}, debug },
      });

      const interceptor: RuntimeMiddleware<MockExec> = {
        name: 'cache',
        async intercept() {
          return { operation: 'query', rows: [{ id: 1 }] };
        },
      };

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [interceptor],
        ctx,
        () => yieldRows([]),
      );

      await result.toArray();

      expect(debug).toHaveBeenCalledTimes(1);
      expect(debug).toHaveBeenCalledWith({
        event: 'middleware.intercept',
        middleware: 'cache',
      });
    });

    it('does not require a debug log function; intercepts succeed without it', async () => {
      const ctx: RuntimeMiddlewareContext = {
        contract: {},
        mode: 'strict',
        now: () => Date.now(),
        // No `debug` field — this is the optional case.
        log: { info: () => {}, warn: () => {}, error: () => {} },
        contentHash: async () => 'mock-hash',
        scope: 'runtime',
        operation: 'query',
        planExecutionId: 'test-fixture-plan-execution-id',
      };

      const interceptor: RuntimeMiddleware<MockExec> = {
        name: 'cache',
        async intercept() {
          return { operation: 'query', rows: [{ id: 1 }] };
        },
      };

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [interceptor],
        ctx,
        () => yieldRows([]),
      );

      await expect(result.toArray()).resolves.toEqual([{ id: 1 }]);
    });

    it('accepts arrays as the row source', async () => {
      const cached = [{ id: 1 }, { id: 2 }];
      const interceptor: RuntimeMiddleware<MockExec> = {
        name: 'array',
        async intercept(): Promise<InterceptResult> {
          return { operation: 'query', rows: cached };
        },
      };

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [interceptor],
        makeCtx(),
        () => yieldRows([]),
      );

      const out = await result.toArray();
      expect(out).toEqual(cached);
    });

    it('accepts sync Iterable (generator function) as the row source', async () => {
      function* syncGen(): Generator<Record<string, unknown>, void, unknown> {
        yield { id: 'a' };
        yield { id: 'b' };
      }
      const interceptor: RuntimeMiddleware<MockExec> = {
        name: 'sync-gen',
        async intercept(): Promise<InterceptResult> {
          return { operation: 'query', rows: syncGen() };
        },
      };

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [interceptor],
        makeCtx(),
        () => yieldRows([]),
      );

      const out = await result.toArray();
      expect(out).toEqual([{ id: 'a' }, { id: 'b' }]);
    });

    it('accepts AsyncIterable (async generator) as the row source', async () => {
      async function* asyncGen(): AsyncGenerator<Record<string, unknown>, void, unknown> {
        yield { id: 'x' };
        yield { id: 'y' };
        yield { id: 'z' };
      }
      const interceptor: RuntimeMiddleware<MockExec> = {
        name: 'async-gen',
        async intercept(): Promise<InterceptResult> {
          return { operation: 'query', rows: asyncGen() };
        },
      };

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [interceptor],
        makeCtx(),
        () => yieldRows([]),
      );

      const out = await result.toArray();
      expect(out).toEqual([{ id: 'x' }, { id: 'y' }, { id: 'z' }]);
    });

    it('rowCount reported in afterExecute matches the number of intercepted rows yielded', async () => {
      let observed: AfterExecuteResult | undefined;
      const interceptor: RuntimeMiddleware<MockExec> = {
        name: 'counter',
        async intercept() {
          return { operation: 'query', rows: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] };
        },
        async afterExecute(_plan, result) {
          observed = result;
        },
      };

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [interceptor],
        makeCtx(),
        () => yieldRows([]),
      );

      await result.toArray();
      expect(observed).toMatchObject({ operation: 'query', rowCount: 4 });
    });
  });

  describe('miss path', () => {
    it('all-undefined intercepts → driver path runs normally with source: "driver"', async () => {
      const events: string[] = [];
      let observed: AfterExecuteResult | undefined;
      const driverRows = [{ id: 1 }, { id: 2 }];

      const a: RuntimeMiddleware<MockExec> = {
        name: 'A',
        async intercept() {
          events.push('A:intercept');
          return undefined;
        },
        async onRow() {
          events.push('A:onRow');
        },
        async afterExecute(_plan, result) {
          observed = result;
          events.push('A:afterExecute');
        },
      };
      const b: RuntimeMiddleware<MockExec> = {
        name: 'B',
        async intercept() {
          events.push('B:intercept');
          return undefined;
        },
      };

      const driverFactory = vi.fn(() => yieldRows(driverRows));

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [a, b],
        makeCtx(),
        driverFactory,
      );

      const out = await result.toArray();

      expect(out).toEqual(driverRows);
      expect(driverFactory).toHaveBeenCalledTimes(1);
      // `beforeExecute` is fired by `runBeforeExecuteChain` outside this
      // helper; the event log here only sees `intercept`, `onRow`, and
      // `afterExecute`.
      expect(events).toEqual([
        'A:intercept',
        'B:intercept',
        'A:onRow',
        'A:onRow',
        'A:afterExecute',
      ]);
      expect(observed?.source).toBe('driver');
    });

    it('middleware without intercept hooks behave as observers (zero-change baseline)', async () => {
      const events: string[] = [];
      const driverRows = [{ id: 1 }];

      const observer: RuntimeMiddleware<MockExec> = {
        name: 'observer',
        async onRow() {
          events.push('onRow');
        },
        async afterExecute() {
          events.push('afterExecute');
        },
      };

      const driverFactory = vi.fn(() => yieldRows(driverRows));

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [observer],
        makeCtx(),
        driverFactory,
      );

      const out = await result.toArray();

      expect(out).toEqual(driverRows);
      expect(driverFactory).toHaveBeenCalledTimes(1);
      expect(events).toEqual(['onRow', 'afterExecute']);
    });

    it('runDriver factory is invoked lazily — only after intercept chain resolves to passthrough', async () => {
      const callOrder: string[] = [];

      const interceptor: RuntimeMiddleware<MockExec> = {
        name: 'late-passthrough',
        async intercept() {
          callOrder.push('intercept');
          return undefined;
        },
      };

      const driverFactory = vi.fn(() => {
        callOrder.push('driverFactory');
        return yieldRows([{ id: 1 }]);
      });

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [interceptor],
        makeCtx(),
        driverFactory,
      );

      await result.toArray();

      // intercept must run before runDriver is called.
      expect(callOrder).toEqual(['intercept', 'driverFactory']);
    });
  });

  describe('error path', () => {
    it('an interceptor that throws → afterExecute fires with completed: false, source: "middleware", and the error is rethrown', async () => {
      const events: string[] = [];
      let observed: AfterExecuteResult | undefined;
      const boom = new Error('intercept boom');

      const interceptor: RuntimeMiddleware<MockExec> = {
        name: 'boom',
        async intercept() {
          events.push('intercept');
          throw boom;
        },
        async afterExecute(_plan, result) {
          observed = result;
          events.push('afterExecute');
        },
      };

      const driverFactory = vi.fn(() => yieldRows([]));

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [interceptor],
        makeCtx(),
        driverFactory,
      );

      await expect(result.toArray()).rejects.toBe(boom);

      expect(events).toEqual(['intercept', 'afterExecute']);
      expect(driverFactory).not.toHaveBeenCalled();
      expect(observed).toMatchObject({
        operation: 'query',
        completed: false,
        source: 'middleware',
        rowCount: 0,
      });
    });

    it('an error thrown while iterating intercepted rows → afterExecute fires with completed: false, source: "middleware"', async () => {
      let observed: AfterExecuteResult | undefined;
      const boom = new Error('rows boom');

      async function* badRows(): AsyncGenerator<Record<string, unknown>, void, unknown> {
        yield { id: 1 };
        throw boom;
      }

      const interceptor: RuntimeMiddleware<MockExec> = {
        name: 'bad-rows',
        async intercept(): Promise<InterceptResult> {
          return { operation: 'query', rows: badRows() };
        },
        async afterExecute(_plan, result) {
          observed = result;
        },
      };

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [interceptor],
        makeCtx(),
        () => yieldRows([]),
      );

      await expect(result.toArray()).rejects.toBe(boom);

      expect(observed).toMatchObject({
        operation: 'query',
        completed: false,
        source: 'middleware',
        rowCount: 1, // one row was yielded before the throw
      });
    });

    it('errors thrown by afterExecute on the intercepted error path are swallowed; the original error is rethrown', async () => {
      const events: string[] = [];
      const interceptError = new Error('intercept boom');
      const afterError = new Error('afterExecute boom');

      const noisy: RuntimeMiddleware<MockExec> = {
        name: 'noisy',
        async intercept() {
          throw interceptError;
        },
        async afterExecute() {
          events.push('noisy:afterExecute');
          throw afterError;
        },
      };
      const tail: RuntimeMiddleware<MockExec> = {
        name: 'tail',
        async afterExecute() {
          events.push('tail:afterExecute');
        },
      };

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [noisy, tail],
        makeCtx(),
        () => yieldRows([]),
      );

      await expect(result.toArray()).rejects.toBe(interceptError);

      // Both afterExecute callbacks ran; the noisy throw was swallowed.
      expect(events).toEqual(['noisy:afterExecute', 'tail:afterExecute']);
    });

    it('afterExecute on the intercept error path runs in registration order across multiple middleware', async () => {
      const events: string[] = [];
      const observed: Array<{ label: string; source: string; completed: boolean }> = [];
      const interceptError = new Error('intercept boom');

      function mw(label: string, doesIntercept: boolean): RuntimeMiddleware<MockExec> {
        return {
          name: label,
          ...(doesIntercept
            ? {
                async intercept(): Promise<InterceptResult | undefined> {
                  events.push(`${label}:intercept`);
                  throw interceptError;
                },
              }
            : {}),
          async afterExecute(_plan, result) {
            observed.push({
              label,
              source: result.source,
              completed: result.completed,
            });
            events.push(`${label}:afterExecute`);
          },
        };
      }

      const result = runWithMiddleware<MockExec, Record<string, unknown>>(
        mockExec,
        [mw('A', false), mw('B', true), mw('C', false)],
        makeCtx(),
        () => yieldRows([]),
      );

      await expect(result.toArray()).rejects.toBe(interceptError);

      // A.intercept doesn't exist; B.intercept throws; C.intercept never runs.
      // afterExecute fires for all three in registration order.
      expect(events).toEqual(['B:intercept', 'A:afterExecute', 'B:afterExecute', 'C:afterExecute']);
      expect(observed).toEqual([
        { label: 'A', source: 'middleware', completed: false },
        { label: 'B', source: 'middleware', completed: false },
        { label: 'C', source: 'middleware', completed: false },
      ]);
    });
  });
});
