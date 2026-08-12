import type { SqlDriver, SqlExecuteRequest } from '@internal/sql-relational-core/ast';
import { RawQueryAst } from '@internal/sql-relational-core/ast';
import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { planFromAst } from '@internal/sql-relational-core/plan';
import { describe, expect, it, vi } from 'vitest';
import {
  collectAsync,
  createStubAdapter,
  createTestContext,
  createTestContract,
  createTestRuntime,
  createTestStackInstance,
} from './utils';

const contract = createTestContract({ storageHash: 'raw-query-routing' });

function createRecordingDriver(): {
  driver: SqlDriver;
  queryCalls: SqlExecuteRequest[];
  executeCalls: SqlExecuteRequest[];
} {
  const queryCalls: SqlExecuteRequest[] = [];
  const executeCalls: SqlExecuteRequest[] = [];

  const driver: SqlDriver = {
    query: vi.fn().mockImplementation(async function* (request: SqlExecuteRequest) {
      queryCalls.push(request);
      yield { id: 1, email: 'a@b.example' };
    }),
    execute: vi.fn().mockImplementation(async (request: SqlExecuteRequest) => {
      executeCalls.push(request);
      return { affectedRows: 3 };
    }),
    connect: vi.fn().mockResolvedValue(undefined),
    acquireConnection: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return { driver, queryCalls, executeCalls };
}

function setup() {
  const adapter = createStubAdapter();
  const { driver, queryCalls, executeCalls } = createRecordingDriver();
  const runtime = createTestRuntime({
    stackInstance: createTestStackInstance(),
    context: createTestContext(contract, adapter),
    driver,
    verifyMarker: false,
  });

  return { runtime, queryCalls, executeCalls };
}

function rowsPlan(): SqlQueryPlan<{ id: unknown; email: unknown }> {
  return planFromAst(
    RawQueryAst.rows(['select id, email from "user"'], {
      id: { codecId: 'pg/int4@1', nullable: false },
      email: { codecId: 'pg/text@1', nullable: false },
    }),
    contract,
  );
}

function affectedCountPlan(): SqlQueryPlan<{ affectedRows: number }> {
  return planFromAst(RawQueryAst.affectedCount(['update "user" set seen = now()']), contract);
}

describe('raw-query execution routing', () => {
  it('streams a row-returning statement through the queryable row path', async () => {
    const { runtime, queryCalls, executeCalls } = setup();

    const rows = await collectAsync(runtime.query(rowsPlan()));

    expect(rows).toEqual([{ id: 1, email: 'a@b.example' }]);
    expect(queryCalls).toHaveLength(1);
    expect(executeCalls).toHaveLength(0);
  });

  it('reports an affected-count statement through the queryable execute path', async () => {
    const { runtime, queryCalls, executeCalls } = setup();

    const stats = await runtime.execute(affectedCountPlan());

    expect(stats).toEqual({ affectedRows: 3 });
    expect(executeCalls).toHaveLength(1);
    expect(queryCalls).toHaveLength(0);
  });

  it('decodes a row plan against its declared spec on the query path', async () => {
    const { runtime } = setup();

    const rows = await collectAsync(runtime.query(rowsPlan()));

    expect(Object.keys(rows[0] ?? {})).toEqual(['id', 'email']);
  });
});
