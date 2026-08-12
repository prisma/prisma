import { assertType, expectTypeOf, test } from 'vitest';
import type {
  AfterExecuteResult,
  AfterQueryResult,
  ExecuteInterceptResult,
  QueryInterceptResult,
  RuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeStatementStats,
} from '../src/execution/runtime-middleware';

test('middleware context has no operation discriminator', () => {
  expectTypeOf<RuntimeMiddlewareContext>().not.toHaveProperty('operation');
});

test('query and execute hooks expose operation-specific result types', () => {
  const middleware: RuntimeMiddleware = {
    name: 'typed',
    async beforeQuery(_plan, ctx) {
      assertType<RuntimeMiddlewareContext>(ctx);
    },
    async interceptQuery(): Promise<QueryInterceptResult> {
      return { rows: [{ id: 1 }] };
    },
    async afterQuery(_plan, result) {
      assertType<AfterQueryResult>(result);
      assertType<number>(result.rowCount);
      // @ts-expect-error - query completion never carries statement statistics
      void result.stats;
      // @ts-expect-error - operation is selected by the hook
      void result.operation;
    },
    async beforeExecute(_plan, ctx) {
      assertType<RuntimeMiddlewareContext>(ctx);
    },
    async interceptExecute(): Promise<ExecuteInterceptResult> {
      return { stats: { affectedRows: 1 } };
    },
    async afterExecute(_plan, result) {
      assertType<AfterExecuteResult>(result);
      if (result.completed) {
        assertType<RuntimeStatementStats>(result.stats);
      } else {
        // @ts-expect-error - failed execution has no statistics
        void result.stats;
      }
      // @ts-expect-error - operation is selected by the hook
      void result.operation;
    },
  };
  void middleware;
});

test('intercept result shapes cannot cross operation hooks', () => {
  const wrongQuery: RuntimeMiddleware = {
    name: 'wrong-query',
    // @ts-expect-error - query interception returns rows, not statistics
    async interceptQuery() {
      return { stats: { affectedRows: 1 } };
    },
  };
  const wrongExecute: RuntimeMiddleware = {
    name: 'wrong-execute',
    // @ts-expect-error - execute interception returns statistics, not rows
    async interceptExecute() {
      return { rows: [{ id: 1 }] };
    },
  };
  void wrongQuery;
  void wrongExecute;
});
