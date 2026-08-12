import type { PlanMeta } from '@internal/contract/types';
import { assertType, expectTypeOf, test } from 'vitest';
import type { ExecutionPlan, QueryPlan, ResultType } from '../src/execution/query-plan';

const meta: PlanMeta = {
  target: 'mock',
  storageHash: 'test',
  lane: 'raw-sql',
};

test('QueryPlan carries meta and the phantom _row parameter', () => {
  expectTypeOf<QueryPlan<{ id: number }>>().toHaveProperty('meta');
  expectTypeOf<QueryPlan<{ id: number }>>().toHaveProperty('_row');
});

test('ExecutionPlan extends QueryPlan with no extra fields', () => {
  type ExecKeys = keyof ExecutionPlan<unknown>;
  type QueryKeys = keyof QueryPlan<unknown>;
  expectTypeOf<ExecKeys>().toEqualTypeOf<QueryKeys>();
});

test('SQL-shaped plan is assignable to QueryPlan<Row>', () => {
  interface SqlShapedPlan {
    readonly sql: string;
    readonly params: readonly unknown[];
    readonly meta: PlanMeta;
    readonly _row?: { id: number };
  }
  const sqlPlan: SqlShapedPlan = {
    sql: 'SELECT 1',
    params: [],
    meta,
  };
  assertType<QueryPlan<{ id: number }>>(sqlPlan);
});

test('SqlQueryPlan-shaped plan is assignable to QueryPlan<Row>', () => {
  interface SqlQueryPlanShape {
    readonly ast: unknown;
    readonly params: readonly unknown[];
    readonly meta: PlanMeta;
    readonly _row?: { id: number };
  }
  const queryPlan: SqlQueryPlanShape = {
    ast: {},
    params: [],
    meta,
  };
  assertType<QueryPlan<{ id: number }>>(queryPlan);
});

test('MongoQueryPlan-shaped plan is assignable to QueryPlan<Row>', () => {
  interface MongoQueryPlanShape {
    readonly collection: string;
    readonly command: unknown;
    readonly meta: PlanMeta;
    readonly _row?: { _id: string };
  }
  const mongoPlan: MongoQueryPlanShape = {
    collection: 'users',
    command: {},
    meta,
  };
  assertType<QueryPlan<{ _id: string }>>(mongoPlan);
});

test('object without meta is not assignable to QueryPlan', () => {
  // @ts-expect-error - missing meta property
  const _bad: QueryPlan = { sql: 'SELECT 1' };
});

test('empty object is not assignable to QueryPlan', () => {
  // @ts-expect-error - missing meta property
  const _bad: QueryPlan = {};
});

test('ResultType extracts Row from a QueryPlan-shaped value', () => {
  interface SqlExecPlan {
    readonly sql: string;
    readonly params: readonly unknown[];
    readonly meta: PlanMeta;
    readonly _row?: { id: number; name: string };
  }
  const plan: SqlExecPlan = { sql: 'SELECT 1', params: [], meta };
  type Row = ResultType<typeof plan>;
  expectTypeOf<Row>().toEqualTypeOf<{ id: number; name: string }>();
});

test('ResultType returns never for objects without _row', () => {
  type Row = ResultType<{ meta: PlanMeta }>;
  expectTypeOf<Row>().toEqualTypeOf(undefined as never);
});
