import { instantiateExecutionStack } from '@internal/framework-components/execution';
import type { SqlDriver, SqlExecuteRequest } from '@internal/sql-relational-core/ast';
import {
  BinaryExpr,
  ColumnRef,
  collectOrderedParamRefs,
  ProjectionItem,
  SelectAst,
  TableSource,
} from '@internal/sql-relational-core/ast';
import type { Expression, ScopeField } from '@internal/sql-relational-core/expression';
import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { describe, expect, it, vi } from 'vitest';
import type { SqlMiddleware } from '../src/middleware/sql-middleware';
import { createSqlExecutionStack } from '../src/sql-context';
import {
  createTestRuntime as createRuntime,
  createStubAdapter,
  createTestAdapterDescriptor,
  createTestContext,
  createTestContract,
  createTestTargetDescriptor,
} from './utils';

/**
 * Pins ADR 220 semantics for the SQL runtime: every `query()`, `execute()`,
 * and `queryPrepared()` call mints a fresh `ctx.planExecutionId` for the
 * per-operation middleware context. Hooks within one call observe the same
 * ID; hooks across two calls of the same plan/prepared-statement observe
 * distinct IDs.
 */

const testContract = createTestContract({ targetFamily: 'sql', target: 'postgres' });

function createMockDriver(rows: ReadonlyArray<Record<string, unknown>> = []): SqlDriver {
  const query = vi.fn().mockImplementation(async function* (_request: SqlExecuteRequest) {
    for (const row of rows) yield row;
  });
  return {
    execute: vi.fn().mockResolvedValue({ affectedRows: 0 }),
    query,
    connect: vi.fn().mockResolvedValue(undefined),
    acquireConnection: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function createSetup(middleware: readonly SqlMiddleware[]) {
  const adapter = createStubAdapter();
  const driver = createMockDriver([{ id: 1 }]);
  const targetDescriptor = createTestTargetDescriptor();
  const adapterDescriptor = createTestAdapterDescriptor(adapter);
  const stack = createSqlExecutionStack({
    target: targetDescriptor,
    adapter: adapterDescriptor,
    extensions: [],
  });
  const stackInstance = instantiateExecutionStack(stack);
  const context = createTestContext(testContract, adapter);
  const runtime = createRuntime({
    stackInstance,
    context,
    driver,
    verifyMarker: false,
    middleware,
  });
  return { runtime, adapter, driver };
}

const meta = {
  target: testContract.target,
  storageHash: testContract.storage.storageHash,
  lane: 'dsl' as const,
};

function buildSelectAllUsersPlan(): SqlQueryPlan<{ id: number }> {
  const users = TableSource.named('users');
  const ast = SelectAst.from(users).withProjection([
    ProjectionItem.of('id', ColumnRef.of('id', 'users'), { codecId: 'pg/int4@1' }),
  ]);
  return Object.freeze({
    ast,
    params: collectOrderedParamRefs(ast).map((r) => (r.kind === 'param-ref' ? r.value : undefined)),
    meta,
  });
}

function buildEqUserIdPlan(userId: Expression<ScopeField>): SqlQueryPlan<{ id: number }> {
  const users = TableSource.named('users');
  const ast = SelectAst.from(users)
    .withProjection([
      ProjectionItem.of('id', ColumnRef.of('id', 'users'), { codecId: 'pg/int4@1' }),
    ])
    .withWhere(BinaryExpr.eq(ColumnRef.of('id', 'users'), userId.buildAst()));
  return Object.freeze({
    ast,
    params: collectOrderedParamRefs(ast).map((r) => (r.kind === 'param-ref' ? r.value : undefined)),
    meta,
  });
}

interface Observation {
  readonly hook: 'beforeExecute' | 'afterExecute';
  readonly planExecutionId: string;
}

function observerMiddleware(log: Observation[]): SqlMiddleware {
  return {
    name: 'observer',
    familyId: 'sql',
    async beforeExecute(_plan, ctx) {
      log.push({ hook: 'beforeExecute', planExecutionId: ctx.planExecutionId });
    },
    async afterExecute(_plan, _result, ctx) {
      log.push({ hook: 'afterExecute', planExecutionId: ctx.planExecutionId });
    },
  };
}

describe('SqlRuntime operation planExecutionId (ADR 220)', () => {
  it('assigns the same planExecutionId to beforeExecute and afterExecute within one query call', async () => {
    const log: Observation[] = [];
    const { runtime } = createSetup([observerMiddleware(log)]);
    const plan = buildSelectAllUsersPlan();

    await runtime.query(plan).toArray();

    expect(log).toHaveLength(2);
    expect(log[0]?.hook).toBe('beforeExecute');
    expect(log[1]?.hook).toBe('afterExecute');
    expect(log[0]?.planExecutionId).toBeTypeOf('string');
    expect(log[0]?.planExecutionId).toBe(log[1]?.planExecutionId);
  });

  it('assigns distinct planExecutionIds to two executions of the same plan instance', async () => {
    const log: Observation[] = [];
    const { runtime } = createSetup([observerMiddleware(log)]);
    const plan = buildSelectAllUsersPlan();

    await runtime.query(plan).toArray();
    await runtime.query(plan).toArray();

    expect(log).toHaveLength(4);
    const firstExecId = log[0]?.planExecutionId;
    const secondExecId = log[2]?.planExecutionId;
    expect(firstExecId).toBeTypeOf('string');
    expect(secondExecId).toBeTypeOf('string');
    // Within one query: beforeExecute and afterExecute share the ID.
    expect(log[0]?.planExecutionId).toBe(log[1]?.planExecutionId);
    expect(log[2]?.planExecutionId).toBe(log[3]?.planExecutionId);
    // Across two queries: distinct IDs.
    expect(firstExecId).not.toBe(secondExecId);
  });

  it('assigns distinct planExecutionIds to query and execute calls', async () => {
    const log: Observation[] = [];
    const { runtime } = createSetup([observerMiddleware(log)]);
    const plan = buildSelectAllUsersPlan();

    await runtime.query(plan).toArray();
    await runtime.execute(plan);

    expect(log).toHaveLength(4);
    expect(log[0]?.planExecutionId).toBe(log[1]?.planExecutionId);
    expect(log[2]?.planExecutionId).toBe(log[3]?.planExecutionId);
    expect(log[0]?.planExecutionId).not.toBe(log[2]?.planExecutionId);
  });
});

describe('SqlRuntime.queryPrepared planExecutionId (ADR 220)', () => {
  it('assigns the same planExecutionId to beforeExecute and afterExecute within one queryPrepared call', async () => {
    const log: Observation[] = [];
    const { runtime } = createSetup([observerMiddleware(log)]);
    const ps = await runtime.prepare({ userId: 'pg/int4@1' as const }, (params) =>
      buildEqUserIdPlan(params.userId),
    );

    await runtime.queryPrepared(ps, { userId: 1 }).toArray();

    expect(log).toHaveLength(2);
    expect(log[0]?.planExecutionId).toBeTypeOf('string');
    expect(log[0]?.planExecutionId).toBe(log[1]?.planExecutionId);
  });

  it('assigns distinct planExecutionIds to two queryPrepared calls on the same prepared statement', async () => {
    const log: Observation[] = [];
    const { runtime } = createSetup([observerMiddleware(log)]);
    const ps = await runtime.prepare({ userId: 'pg/int4@1' as const }, (params) =>
      buildEqUserIdPlan(params.userId),
    );

    await runtime.queryPrepared(ps, { userId: 1 }).toArray();
    await runtime.queryPrepared(ps, { userId: 2 }).toArray();

    expect(log).toHaveLength(4);
    expect(log[0]?.planExecutionId).toBe(log[1]?.planExecutionId);
    expect(log[2]?.planExecutionId).toBe(log[3]?.planExecutionId);
    expect(log[0]?.planExecutionId).not.toBe(log[2]?.planExecutionId);
  });
});
