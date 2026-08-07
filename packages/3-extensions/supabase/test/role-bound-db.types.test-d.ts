/**
 * Type-level invariant: RoleBoundDb must not expose a connection() method.
 *
 * The security guarantee is facade-encapsulation — SupabaseRuntimeImpl inherits
 * a public connection() from SqlRuntimeBase, but the role-bound Db surface must
 * never surface it. This test locks the compile-time side of that invariant.
 */

import type { AsyncIterableResult } from '@internal/framework-components/runtime';
import type { SqlStatementStats } from '@internal/sql-relational-core/ast';
import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { expectTypeOf, test } from 'vitest';
import type { RoleBoundDb, SupabaseInternalDb } from '../src/runtime/supabase';
import type { RoleSession, SupabaseRuntime } from '../src/runtime/supabase-runtime';

type Row = { readonly id: string };
declare const plan: SqlQueryPlan<Row>;
declare const roleBoundDb: RoleBoundDb<never>;
declare const internalDb: SupabaseInternalDb;
declare const session: RoleSession;
declare const runtime: SupabaseRuntime;

test('RoleBoundDb has no connection property', () => {
  expectTypeOf<RoleBoundDb<never>>().not.toHaveProperty('connection');
});

test('role-bound public roots expose row query and statistics execute', () => {
  expectTypeOf(roleBoundDb.query(plan)).toEqualTypeOf<AsyncIterableResult<Row>>();
  expectTypeOf(roleBoundDb.execute(plan)).toEqualTypeOf<Promise<SqlStatementStats>>();
  expectTypeOf(internalDb.query(plan)).toEqualTypeOf<AsyncIterableResult<Row>>();
  expectTypeOf(internalDb.execute(plan)).toEqualTypeOf<Promise<SqlStatementStats>>();
});

test('role-bound runtime exposes row query and statistics execute', () => {
  expectTypeOf(runtime.queryWithRole(plan, { role: 'anon' })).toEqualTypeOf<
    AsyncIterableResult<Row>
  >();
  expectTypeOf(runtime.executeWithRole(plan, { role: 'anon' })).toEqualTypeOf<
    Promise<SqlStatementStats>
  >();
});

test('role session and transaction expose row query and statistics execute', async () => {
  expectTypeOf(session.query(plan)).toEqualTypeOf<AsyncIterableResult<Row>>();
  expectTypeOf(session.execute(plan)).toEqualTypeOf<Promise<SqlStatementStats>>();

  const transaction = await session.transaction();
  expectTypeOf(transaction.query(plan)).toEqualTypeOf<AsyncIterableResult<Row>>();
  expectTypeOf(transaction.execute(plan)).toEqualTypeOf<Promise<SqlStatementStats>>();
});
