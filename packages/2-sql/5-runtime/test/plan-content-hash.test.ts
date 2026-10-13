import { ParamRef, RawQueryAst, SelectAst, TableSource } from '@internal/sql-relational-core/ast';
import { planFromAst, type SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { describe, expect, it, vi } from 'vitest';
import { planContentHashOn, startActivityOn } from '../src/activity-handle';
import type { SqlMiddleware, SqlMiddlewareContext } from '../src/middleware/sql-middleware';
import { withTransaction } from '../src/sql-runtime';
import { testCall } from './client-activity-kinds';
import {
  createSetup,
  doublingCodec,
  meta,
  rawPlan,
  testContract,
} from './transaction-activity-fixtures';

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

    const hash = await planContentHashOn(runtime, queryPlan());
    await runtime.execute(queryPlan());

    expect(hashes).toEqual([hash]);
  });

  it('equals it for an execution plan too', async () => {
    const hashes: string[] = [];
    const { runtime } = createSetup({ middleware: [hashRecorder(hashes)] });

    const hash = await planContentHashOn(runtime, rawPlan('update t set x = 1'));
    await runtime.execute(rawPlan('update t set x = 1'));

    expect(hashes).toEqual([hash]);
  });

  it('equals it for parameters that a codec encodes', async () => {
    const seen: Array<{ readonly hash: string; readonly params: readonly unknown[] }> = [];
    const { runtime } = createSetup({
      middleware: [
        {
          name: 'hashes',
          familyId: 'sql',
          intercept: {
            async onExecute(plan, ctx) {
              seen.push({ hash: await ctx.contentHash(plan), params: plan.params });
              return undefined;
            },
          },
        },
      ],
    });
    const plan = () =>
      planFromAst(
        RawQueryAst.affectedCount([
          'update t set x = ',
          ParamRef.of(21, { codec: { codecId: doublingCodec.id } }),
        ]),
        testContract,
      );

    const hash = await planContentHashOn(runtime, plan());
    await runtime.execute(plan());

    expect(seen).toEqual([{ hash, params: [42] }]);
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

    expect(await planContentHashOn(rewriting.runtime, queryPlan())).toBe(
      await planContentHashOn(plain.runtime, queryPlan('rewritten')),
    );
  });

  it('does not run beforeEncode or start an activity', async () => {
    const beforeEncode = vi.fn();
    const { runtime, events } = createSetup({
      middleware: [{ name: 'encode', familyId: 'sql', beforeEncode }],
    });

    await planContentHashOn(runtime, queryPlan());

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
      async activityStarted(_activity, ctx) {
        ctx.state('key')['written'] = true;
      },
      async beforeCompile(_draft, ctx) {
        contexts.push(ctx);
        return undefined;
      },
    };
    const { runtime, events } = createSetup({ middleware: [observer] });
    let states: unknown[] = [];

    await withTransaction(runtime, async (tx) => {
      const call = await startActivityOn(tx, testCall);
      await call.planContentHash(queryPlan());
      const callState = events
        .find((event) => event.name === 'started:test-call')
        ?.ctx?.state('key');
      states = [callState, contexts[0]?.state('key')];
      await call.end({ outcome: 'succeeded' });
    });
    const callCtx = events.find((event) => event.name === 'started:test-call')?.ctx;

    expect(contexts.map((ctx) => [ctx.scope, ctx.parent, ctx.inTransaction()])).toEqual([
      ['transaction', callCtx, true],
    ]);
    expect(states).toEqual([{ written: true }, {}]);
  });
});
