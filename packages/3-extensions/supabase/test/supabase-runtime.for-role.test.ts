import { RawQueryAst } from '@internal/sql-relational-core/ast';
import type { AffectedCount } from '@internal/sql-relational-core/expression';
import { planFromAst, type SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { activitySource } from '@internal/sql-runtime';
import { describe, expect, it } from 'vitest';
import type { SupabaseRoleBinding, SupabaseRuntimeImpl } from '../src/runtime/supabase-runtime';
import { createTestSetup, stubPlan, testContract } from './supabase-runtime-fixtures';

declare module '@internal/framework-components/runtime' {
  interface ClientActivityRegistry {
    'for-role-call': { result: unknown };
  }
}

type RoleRuntime = ReturnType<SupabaseRuntimeImpl['forRole']>;

const binding: SupabaseRoleBinding = { role: 'authenticated', claims: { sub: 'user-1' } };
const closedError = { code: 'DRIVER.NOT_CONNECTED', message: 'Runtime is closed' };
const testCall = { kind: 'for-role-call', contentHash: async () => 'call-hash' } as const;

const roleSql = ['SELECT set_config($1, $2, false)', 'SELECT set_config($1, $2, false)'] as const;

function nextTurn(): Promise<void> {
  return new Promise((settle) => setTimeout(settle, 0));
}

function bumpPlan(): SqlQueryPlan<AffectedCount> {
  return planFromAst(RawQueryAst.affectedCount(['update "users" set seen = now()']), testContract);
}

describe('forRole(binding)', () => {
  it('runs prepared statements on a role session it releases', async () => {
    const { runtime, driver } = createTestSetup({ affectedRows: 2 });
    const role = runtime.forRole(binding);
    const selectOne = await runtime.prepare({}, () => stubPlan());
    const bump = await runtime.prepare({}, () => bumpPlan());

    const rows = await selectOne.query(role, {}).toArray();
    const stats = await bump.execute(role, {});

    expect({
      rows,
      stats,
      connectionSql: driver.connection.executeCalls.map((call) => call.sql),
      released: driver.connection.release.mock.calls.length,
      driverQueried: driver.query.mock.calls.length + driver.execute.mock.calls.length,
    }).toEqual({
      rows: [{ id: 1 }],
      stats: { affectedRows: 2 },
      connectionSql: [...roleSql, 'RESET ALL', ...roleSql, expect.any(String), 'RESET ALL'],
      released: 2,
      driverQueried: 0,
    });
  });

  it('begins a transaction on a role session it releases after the commit', async () => {
    const { runtime, driver } = createTestSetup();

    const transaction = await runtime.forRole(binding).transaction();
    await transaction.execute(stubPlan());
    await transaction.commit();

    expect({
      connectionSql: driver.connection.executeCalls.map((call) => call.sql),
      transactionSql: driver.connection.transaction.executeCalls.map((call) => call.sql),
      committed: driver.connection.transaction.commit.mock.calls.length,
      released: driver.connection.release.mock.calls.length,
    }).toEqual({
      connectionSql: [...roleSql, 'RESET ALL'],
      transactionSql: ['select 1'],
      committed: 1,
      released: 1,
    });
  });

  it('gives its role session from connection()', async () => {
    const { runtime, driver } = createTestSetup();

    const session = await runtime.forRole(binding).connection();
    await session.execute(stubPlan());
    await session.release();

    expect(driver.connection.executeCalls.map((call) => call.sql)).toEqual([
      ...roleSql,
      'select 1',
      'RESET ALL',
    ]);
  });
});

describe('forRole(binding) after close()', () => {
  it.each([
    ['query', (role: RoleRuntime) => role.query(stubPlan()).toArray()],
    ['execute', (role: RoleRuntime) => role.execute(stubPlan())],
    ['connection', (role: RoleRuntime) => role.connection()],
    ['transaction', (role: RoleRuntime) => role.transaction()],
    ['an activity', (role: RoleRuntime) => role[activitySource].startActivity(testCall)],
  ] as const)('refuses %s without opening a session', async (_name, run) => {
    const { runtime, driver } = createTestSetup();
    const role = runtime.forRole(binding);
    await runtime.close();

    await expect(run(role)).rejects.toMatchObject(closedError);
    expect(driver.acquireConnectionSpy).not.toHaveBeenCalled();
  });

  it('lets an activity started before close() open its role sessions, and close() waits for it', async () => {
    const { runtime, driver } = createTestSetup();
    const call = await runtime.forRole(binding)[activitySource].startActivity(testCall);

    let closed = false;
    const closing = runtime.close().then(() => {
      closed = true;
    });
    await nextTurn();
    await call.execute(stubPlan());
    const transaction = await call.transaction?.();
    await transaction?.commit();
    const closedBeforeEnd = closed;
    await call.end({ outcome: 'succeeded' });
    await closing;

    expect({
      closedBeforeEnd,
      sessions: driver.acquireConnectionSpy.mock.calls.length,
      released: driver.connection.release.mock.calls.length,
      driverClosed: driver.close.mock.calls.length,
    }).toEqual({ closedBeforeEnd: false, sessions: 2, released: 2, driverClosed: 1 });
  });

  it('makes close() wait for an open role transaction to commit', async () => {
    const { runtime, driver } = createTestSetup();
    const transaction = await runtime.forRole(binding).transaction();

    let closed = false;
    const closing = runtime.close().then(() => {
      closed = true;
    });
    await nextTurn();
    await nextTurn();
    await transaction.execute(stubPlan());
    const closedWhileOpen = closed;
    await transaction.commit();
    await closing;

    expect({
      closedWhileOpen,
      transactionSql: driver.connection.transaction.executeCalls.map((call) => call.sql),
      driverClosed: driver.close.mock.calls.length,
    }).toEqual({ closedWhileOpen: false, transactionSql: ['select 1'], driverClosed: 1 });
  });
});
