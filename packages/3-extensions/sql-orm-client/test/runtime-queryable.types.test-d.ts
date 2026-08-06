import type { AsyncIterableResult } from '@internal/framework-components/runtime';
import type { SqlStatementStats } from '@internal/sql-relational-core/ast';
import type { SqlExecutionPlan, SqlQueryPlan } from '@internal/sql-relational-core/plan';
import type {
  RuntimeScope as CanonicalRuntimeScope,
  SqlOrmPlan,
} from '@internal/sql-relational-core/types';
import type { Runtime, RuntimeQueryable as SqlRuntimeQueryable } from '@internal/sql-runtime';
import { expectTypeOf, test } from 'vitest';
import type { RuntimeConnection, RuntimeQueryable, RuntimeTransaction } from '../src/types';

test('RuntimeScope from sql-relational-core is the canonical SQL runtime surface', () => {
  expectTypeOf<SqlOrmPlan>().toEqualTypeOf<SqlExecutionPlan | SqlQueryPlan>();
});

test('sql-runtime RuntimeQueryable extends the canonical RuntimeScope', () => {
  const runtimeQueryable = {} as SqlRuntimeQueryable;
  expectTypeOf(runtimeQueryable).toExtend<CanonicalRuntimeScope>();
});

test('RuntimeQueryable extends RuntimeScope with optional SQL-domain connection/transaction methods', () => {
  const queryable = {} as RuntimeQueryable;
  expectTypeOf(queryable).toExtend<CanonicalRuntimeScope>();
  expectTypeOf<RuntimeQueryable['connection']>().toEqualTypeOf<
    (() => Promise<RuntimeConnection>) | undefined
  >();
  expectTypeOf<RuntimeQueryable['transaction']>().toEqualTypeOf<
    (() => Promise<RuntimeTransaction>) | undefined
  >();
});

test('RuntimeConnection and RuntimeTransaction inherit the canonical execute surface', () => {
  const connection = {} as RuntimeConnection;
  const transaction = {} as RuntimeTransaction;
  expectTypeOf(connection).toExtend<CanonicalRuntimeScope>();
  expectTypeOf(transaction).toExtend<CanonicalRuntimeScope>();
});

test('SQL Runtime is structurally assignable to RuntimeQueryable', () => {
  const runtime = {} as Runtime;
  expectTypeOf(runtime).toExtend<RuntimeQueryable>();
});

test('RuntimeScope query returns rows and execute returns statistics', () => {
  type Row = { id: number; name: string };
  const plan = {} as SqlQueryPlan<Row>;
  const scope = {} as CanonicalRuntimeScope;
  expectTypeOf(scope.query(plan)).toEqualTypeOf<AsyncIterableResult<Row>>();
  expectTypeOf(scope.execute(plan)).toEqualTypeOf<Promise<SqlStatementStats>>();
});

test('RuntimeScope query accepts a pre-lowered plan with a row binding', () => {
  type Row = { count: number };
  const plan = {} as SqlExecutionPlan<Row>;
  const scope = {} as CanonicalRuntimeScope;
  expectTypeOf(scope.query(plan)).toEqualTypeOf<AsyncIterableResult<Row>>();
});
