import type { PlanMeta } from '@internal/contract/types';
import type { QueryPlan, ResultType } from '@internal/framework-components/runtime';
import { assertType, expectTypeOf, test } from 'vitest';
import { InsertOneCommand } from '../src/commands';
import type { MongoQueryPlan } from '../src/query-plan';

const meta: PlanMeta = {
  target: 'mongodb',
  storageHash: 'test',
  lane: 'mongo',
};

test('MongoQueryPlan extends framework QueryPlan', () => {
  const plan: MongoQueryPlan<{ _id: string }> = {
    collection: 'orders',
    command: new InsertOneCommand('orders', { _id: 'abc' }),
    meta,
  };
  assertType<QueryPlan<{ _id: string }>>(plan);
});

test('Row type is recoverable via framework ResultType', () => {
  const plan: MongoQueryPlan<{ _id: string; status: string }> = {
    collection: 'orders',
    command: new InsertOneCommand('orders', { _id: 'abc', status: 'open' }),
    meta,
  };
  type Row = ResultType<typeof plan>;
  expectTypeOf<Row>().toEqualTypeOf<{ _id: string; status: string }>();
});

test('MongoQueryPlan carries collection, command, meta, and phantom _row', () => {
  expectTypeOf<MongoQueryPlan>().toHaveProperty('collection');
  expectTypeOf<MongoQueryPlan>().toHaveProperty('command');
  expectTypeOf<MongoQueryPlan>().toHaveProperty('meta');
  expectTypeOf<MongoQueryPlan>().toHaveProperty('_row');
});
