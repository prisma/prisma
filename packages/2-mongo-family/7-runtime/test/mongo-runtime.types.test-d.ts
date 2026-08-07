import type {
  AsyncIterableResult,
  RuntimeStatementStats,
} from '@internal/framework-components/runtime';
import type { MongoQueryPlan } from '@internal/mongo-query-ast/execution';
import { expectTypeOf, test } from 'vitest';
import type { MongoMiddleware, MongoMiddlewareContext } from '../src/mongo-middleware';
import type { MongoRuntime } from '../src/mongo-runtime';

test('MongoRuntime exposes row queries and statistics execution', () => {
  type Row = { readonly id: string };
  const runtime = {} as MongoRuntime;
  const plan = {} as MongoQueryPlan<Row>;

  expectTypeOf(runtime.query(plan)).toEqualTypeOf<AsyncIterableResult<Row>>();
  expectTypeOf(runtime.execute(plan)).toEqualTypeOf<Promise<RuntimeStatementStats>>();
});

test('MongoMiddleware narrows familyId to optional `mongo`', () => {
  expectTypeOf<MongoMiddleware['familyId']>().toEqualTypeOf<'mongo' | undefined>();
});

test('MongoMiddlewareContext extends RuntimeMiddlewareContext', () => {
  expectTypeOf<MongoMiddlewareContext>().toHaveProperty('contract');
  expectTypeOf<MongoMiddlewareContext>().toHaveProperty('mode');
  expectTypeOf<MongoMiddlewareContext>().toHaveProperty('log');
  expectTypeOf<MongoMiddlewareContext>().toHaveProperty('now');
  expectTypeOf<MongoMiddlewareContext>().toHaveProperty('contentHash');
  expectTypeOf<MongoMiddlewareContext>().toHaveProperty('scope');
  expectTypeOf<MongoMiddlewareContext['scope']>().toEqualTypeOf<
    'runtime' | 'connection' | 'transaction'
  >();
});
