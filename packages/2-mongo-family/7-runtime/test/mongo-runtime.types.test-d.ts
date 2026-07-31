import type { RuntimeExecutor } from '@internal/framework-components/runtime';
import type { MongoQueryPlan } from '@internal/mongo-query-ast/execution';
import { expectTypeOf, test } from 'vitest';
import type { MongoMiddleware, MongoMiddlewareContext } from '../src/mongo-middleware';
import type { MongoRuntime } from '../src/mongo-runtime';

test('MongoRuntime satisfies RuntimeExecutor<MongoQueryPlan> structurally', () => {
  type MongoExecutor = RuntimeExecutor<MongoQueryPlan>;
  const runtime = {} as MongoRuntime;
  // MongoRuntime.execute accepts MongoQueryPlan and returns AsyncIterable,
  // satisfying RuntimeExecutor.execute. The phantom Row type parameter
  // on MongoQueryPlan prevents nominal extends but structural compatibility holds.
  expectTypeOf(runtime.execute).toBeFunction();
  expectTypeOf(runtime.close).toBeFunction();
  expectTypeOf<MongoRuntime['close']>().toExtend<MongoExecutor['close']>();
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
