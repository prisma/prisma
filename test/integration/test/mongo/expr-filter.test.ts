import type { PlanMeta } from '@internal/contract/types';
import type { MongoQueryPlan } from '@internal/mongo-query-ast/execution';
import {
  AggregateCommand,
  MongoAggFieldRef,
  MongoAggLiteral,
  MongoAggOperator,
  MongoAndExpr,
  MongoExprFilter,
  MongoFieldFilter,
  MongoMatchStage,
} from '@internal/mongo-query-ast/execution';
import { expect, it } from 'vitest';
import { describeWithMongoDB } from './setup';

const testMeta: PlanMeta = {
  target: 'mongo',
  storageHash: 'test-hash',
  lane: 'expr-filter-test',
};

function plan(collection: string, command: MongoQueryPlan['command']): MongoQueryPlan {
  return { collection, command, meta: testMeta };
}

// describeWithMongoDB drops the database before each test (see setup.ts beforeEach).
describeWithMongoDB('MongoExprFilter integration ($expr)', (ctx) => {
  const col = 'inventory';

  it('cross-field comparison via $expr: qty > minQty', async () => {
    const db = ctx.client.db(ctx.dbName);
    await db.collection(col).insertMany([
      { item: 'A', qty: 100, minQty: 50 },
      { item: 'B', qty: 30, minQty: 50 },
      { item: 'C', qty: 80, minQty: 80 },
    ]);

    const filter = MongoExprFilter.of(
      MongoAggOperator.of('$gt', [MongoAggFieldRef.of('qty'), MongoAggFieldRef.of('minQty')]),
    );
    const command = new AggregateCommand(col, [new MongoMatchStage(filter)]);

    const results = await ctx.runtime.execute(plan(col, command));
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ item: 'A', qty: 100, minQty: 50 });
  });

  it('computed $expr with arithmetic: price > discount * 2', async () => {
    const db = ctx.client.db(ctx.dbName);
    await db.collection(col).insertMany([
      { item: 'X', price: 120, discount: 50 },
      { item: 'Y', price: 90, discount: 50 },
      { item: 'Z', price: 200, discount: 80 },
    ]);

    const filter = MongoExprFilter.of(
      MongoAggOperator.of('$gt', [
        MongoAggFieldRef.of('price'),
        MongoAggOperator.multiply(MongoAggFieldRef.of('discount'), MongoAggLiteral.of(2)),
      ]),
    );
    const command = new AggregateCommand(col, [new MongoMatchStage(filter)]);

    const results = await ctx.runtime.execute(plan(col, command));
    expect(results).toHaveLength(2);
    const items = (results as Array<{ item: string }>).map((r) => r.item).sort();
    expect(items).toEqual(['X', 'Z']);
  });

  it('$expr combined with regular field filter via $and', async () => {
    const db = ctx.client.db(ctx.dbName);
    await db.collection(col).insertMany([
      { item: 'A', qty: 100, minQty: 50, status: 'active' },
      { item: 'B', qty: 100, minQty: 50, status: 'inactive' },
      { item: 'C', qty: 30, minQty: 50, status: 'active' },
    ]);

    const filter = MongoAndExpr.of([
      MongoFieldFilter.eq('status', 'active'),
      MongoExprFilter.of(
        MongoAggOperator.of('$gt', [MongoAggFieldRef.of('qty'), MongoAggFieldRef.of('minQty')]),
      ),
    ]);
    const command = new AggregateCommand(col, [new MongoMatchStage(filter)]);

    const results = await ctx.runtime.execute(plan(col, command));
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ item: 'A', status: 'active' });
  });
});
