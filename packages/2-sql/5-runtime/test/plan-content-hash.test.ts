import { SelectAst, TableSource } from '@internal/sql-relational-core/ast';
import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { describe, expect, it, vi } from 'vitest';
import { startActivityOn } from '../src/activity-handle';
import type { SqlMiddleware, SqlMiddlewareContext } from '../src/middleware/sql-middleware';
import { withTransaction } from '../src/sql-runtime';
import { testCall } from './client-activity-kinds';
import { createSetup, meta, rawPlan } from './transaction-activity-fixtures';

function queryPlan(table = 'users'): SqlQueryPlan {
  return { ast: SelectAst.from(TableSource.named(table)), params: [], meta };
}

function hashRecorder(hashes: string[]): SqlMiddleware {
  return {
    name: 'hashes',
    familyId: 'sql',
    intercept: {
      async onExecute(plan, ctx) {
        hashes.push(await ctx.contentHash(plan));
        return undefined;
      },
    },
  };
}

describe('planContentHash', () => {
  it('equals the content hash of the statement the plan sends', async () => {
    const hashes: string[] = [];
    const { runtime } = createSetup({ middleware: [hashRecorder(hashes)] });

    const hash = await runtime.planContentHash(queryPlan());
    await runtime.execute(queryPlan());

    expect(hashes).toEqual([hash]);
  });

  it('equals it for an execution plan too', async () => {
    const hashes: string[] = [];
    const { runtime } = createSetup({ middleware: [hashRecorder(hashes)] });

    const hash = await runtime.planContentHash(rawPlan('update t set x = 1'));
    await runtime.execute(rawPlan('update t set x = 1'));

    expect(hashes).toEqual([hash]);
  });

  it('reflects a beforeCompile rewrite', async () => {
    const rewriter: SqlMiddleware = {
      name: 'rewriter',
      familyId: 'sql',
      async beforeCompile(draft) {
        return { ...draft, ast: SelectAst.from(TableSource.named('rewritten')) };
      },
    };
    const plain = createSetup();
    const rewriting = createSetup({ middleware: [rewriter] });

    expect(await rewriting.runtime.planContentHash(queryPlan())).toBe(
      await plain.runtime.planContentHash(queryPlan('rewritten')),
    );
  });

  it('does not run beforeEncode or start an activity', async () => {
    const beforeEncode = vi.fn();
    const { runtime, events } = createSetup({
      middleware: [{ name: 'encode', familyId: 'sql', beforeEncode }],
    });

    await runtime.planContentHash(queryPlan());

    expect({
      beforeEncode: beforeEncode.mock.calls.length,
      events: events.map((e) => e.name),
    }).toEqual({
      beforeEncode: 0,
      events: [],
    });
  });

  it('gives beforeCompile the scope and parent of the queryable, and fresh state', async () => {
    const contexts: SqlMiddlewareContext[] = [];
    const observer: SqlMiddleware = {
      name: 'compile',
      familyId: 'sql',
      async beforeCompile(_draft, ctx) {
        contexts.push(ctx);
        return undefined;
      },
    };
    const { runtime, events } = createSetup({ middleware: [observer] });

    await withTransaction(runtime, async (tx) => {
      const call = await startActivityOn(tx, testCall);
      await call.planContentHash(queryPlan());
      await call.end({ outcome: 'succeeded' });
    });
    const callCtx = events.find((event) => event.name === 'started:test-call')?.ctx;

    expect(contexts.map((ctx) => [ctx.scope, ctx.parent, ctx.inTransaction()])).toEqual([
      ['transaction', callCtx, true],
    ]);
    expect(contexts[0]?.state('key')).toEqual({});
  });
});
