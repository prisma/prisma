/**
 * Offline unit tests for the custom `slowQueryWarning` middleware example.
 *
 * Drives the middleware's `afterExecute` hook directly with a hand-built
 * execution plan and context — no database required. The plan's `ast` and
 * `meta` come from a real DSL build so the shapes match what the runtime
 * hands to middleware.
 */
import type { AfterExecuteResult, SqlMiddlewareContext } from '@prisma/orm-postgres/family-runtime';
import { describe, expect, it } from 'vitest';
import { db } from '../src/prisma/db';
import { slowQueryWarning } from '../src/prisma/slow-query-warning';

function makeContext(warnEvents: unknown[]): SqlMiddlewareContext {
  return {
    contract: db.contract,
    mode: 'strict',
    now: () => Date.now(),
    log: {
      info: () => {},
      warn: (event) => {
        warnEvents.push(event);
      },
      error: () => {},
    },
    contentHash: async () => 'test-content-hash',
    scope: 'runtime',
    planExecutionId: 'test-plan-execution',
  };
}

function makeExecutionPlan() {
  const built = db.sql.public.user.select('id', 'email').limit(1).build();
  return {
    sql: 'SELECT "id", "email" FROM "user" LIMIT 1',
    params: [],
    ast: built.ast,
    meta: built.meta,
  };
}

function makeResult(latencyMs: number): AfterExecuteResult {
  return { rowCount: 1, latencyMs, completed: true, source: 'driver' };
}

describe('slowQueryWarning middleware', () => {
  it('logs a warning when latency exceeds the threshold', async () => {
    const warnEvents: unknown[] = [];
    const middleware = slowQueryWarning({ thresholdMs: 250 });

    await middleware.afterExecute?.(makeExecutionPlan(), makeResult(900), makeContext(warnEvents));

    expect(warnEvents).toHaveLength(1);
    expect(warnEvents[0]).toMatchObject({
      code: 'APP.SLOW_QUERY',
      details: {
        sql: 'SELECT "id", "email" FROM "user" LIMIT 1',
        latencyMs: 900,
        rowCount: 1,
        source: 'driver',
        planExecutionId: 'test-plan-execution',
      },
    });
  });

  it('stays silent at or below the threshold', async () => {
    const warnEvents: unknown[] = [];
    const middleware = slowQueryWarning({ thresholdMs: 250 });

    await middleware.afterExecute?.(makeExecutionPlan(), makeResult(250), makeContext(warnEvents));

    expect(warnEvents).toHaveLength(0);
  });

  it('defaults the threshold to 250ms', async () => {
    const warnEvents: unknown[] = [];
    const middleware = slowQueryWarning();

    await middleware.afterExecute?.(makeExecutionPlan(), makeResult(251), makeContext(warnEvents));

    expect(warnEvents).toHaveLength(1);
  });
});
