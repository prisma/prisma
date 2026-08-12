import type { PlanMeta } from '@internal/contract/types';
import type { ExecutionPlan, QueryPlan, ResultType } from '@internal/framework-components/runtime';
import { assertType, expectTypeOf, test } from 'vitest';
import type { AnyQueryAst } from '../src/ast/types';
import type { SqlExecutionPlan } from '../src/sql-execution-plan';

const meta: PlanMeta = {
  target: 'postgres',
  storageHash: 'test',
  lane: 'sql',
};

const ast = {} as AnyQueryAst;

test('SqlExecutionPlan extends framework ExecutionPlan and QueryPlan', () => {
  const plan: SqlExecutionPlan<{ id: number }> = {
    sql: 'SELECT 1',
    params: [],
    ast,
    meta,
  };
  assertType<ExecutionPlan<{ id: number }>>(plan);
  assertType<QueryPlan<{ id: number }>>(plan);
});

test('SqlExecutionPlan carries sql, params, ast, meta, and phantom _row', () => {
  expectTypeOf<SqlExecutionPlan>().toHaveProperty('sql');
  expectTypeOf<SqlExecutionPlan>().toHaveProperty('params');
  expectTypeOf<SqlExecutionPlan>().toHaveProperty('ast');
  expectTypeOf<SqlExecutionPlan>().toHaveProperty('meta');
  expectTypeOf<SqlExecutionPlan>().toHaveProperty('_row');
});

test('Row type is recoverable via ResultType', () => {
  const plan: SqlExecutionPlan<{ id: number; email: string }> = {
    sql: 'SELECT id, email FROM users',
    params: [],
    ast,
    meta,
  };
  type Row = ResultType<typeof plan>;
  expectTypeOf<Row>().toEqualTypeOf<{ id: number; email: string }>();
});

test('Plan without sql does not satisfy SqlExecutionPlan', () => {
  // @ts-expect-error - missing sql property
  const _bad: SqlExecutionPlan = { params: [], meta };
});

test('Plan without params does not satisfy SqlExecutionPlan', () => {
  // @ts-expect-error - missing params property
  const _bad: SqlExecutionPlan = { sql: 'SELECT 1', meta };
});
