import type { PlanMeta } from '@internal/contract/types';
import type { MongoQueryPlan } from '@internal/mongo-query-ast/execution';
import {
  AggregateCommand,
  MongoFieldFilter,
  MongoMatchStage,
} from '@internal/mongo-query-ast/execution';
import { expect, it } from 'vitest';
import { describeWithMongoDB } from './setup';

const testMeta: PlanMeta = {
  target: 'mongo',
  storageHash: 'test-hash',
  lane: 'execution-abort-test',
};

function plan(collection: string, command: MongoQueryPlan['command']): MongoQueryPlan {
  return { collection, command, meta: testMeta };
}

describeWithMongoDB('integration: mongoRuntime.execute({ signal }) — abort semantics', (ctx) => {
  const col = 'execution_abort_users';

  async function seed(): Promise<void> {
    const db = ctx.client.db(ctx.dbName);
    await db.collection(col).insertMany([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
      { name: 'Carol', age: 40 },
    ]);
  }

  it('already-aborted signal at execute() entry rejects on first iteration with RUNTIME.ABORTED { phase: stream }', async () => {
    await seed();
    const controller = new AbortController();
    const reason = new Error('user cancelled before mongoRuntime.execute');
    controller.abort(reason);

    const queryPlan = plan(col, new AggregateCommand(col, []));

    await expect(ctx.runtime.query(queryPlan, { signal: controller.signal })).rejects.toMatchObject(
      {
        code: 'RUNTIME.ABORTED',
        details: { phase: 'stream' },
        cause: reason,
      },
    );
  });

  it('regression — omitting options is identical to today (stream completes with all rows)', async () => {
    await seed();
    const queryPlan = plan(col, new AggregateCommand(col, []));
    const rows = (await ctx.runtime.query(queryPlan)) as Array<{ name: string; age: number }>;
    const names = rows.map((r) => r.name).sort();
    expect(names).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('execute(plan, {}) and execute(plan, undefined) match the no-options shape', async () => {
    await seed();
    const filter = MongoFieldFilter.eq('name', 'Alice');
    const queryPlan = plan(col, new AggregateCommand(col, [new MongoMatchStage(filter)]));
    const a = (await ctx.runtime.query(queryPlan, {})) as Array<{ name: string }>;
    expect(a.map((r) => r.name)).toEqual(['Alice']);

    const b = (await ctx.runtime.query(queryPlan, undefined)) as Array<{ name: string }>;
    expect(b.map((r) => r.name)).toEqual(['Alice']);
  });
});
