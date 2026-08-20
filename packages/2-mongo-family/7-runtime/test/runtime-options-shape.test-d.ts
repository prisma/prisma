import type { MongoCodecRegistry } from '@internal/mongo-codec';
import { test } from 'vitest';
import type { MongoExecutionContext, MongoRuntimeOptions } from '../src/exports/index';
import { createMongoRuntime } from '../src/mongo-runtime';

declare const ctx: MongoExecutionContext;

test('runtime options accept only context, driver, middleware, and mode', () => {
  createMongoRuntime({
    context: ctx,
    driver: {} as never,
  });

  createMongoRuntime({
    context: ctx,
    driver: {} as never,
    // @ts-expect-error `codecs` is not a property of MongoRuntimeOptions —
    // codecs are aggregated via `createMongoExecutionContext` and reached
    // through `context.codecs`.
    codecs: {} as MongoCodecRegistry,
  });

  createMongoRuntime({
    context: ctx,
    driver: {} as never,
    // @ts-expect-error `adapter` is not a property of MongoRuntimeOptions —
    // the adapter is reached via `context.stack.adapter`.
    adapter: {} as never,
  });

  createMongoRuntime({
    context: ctx,
    driver: {} as never,
    // @ts-expect-error `targetId` is not a property of MongoRuntimeOptions —
    // the target is reached via `context.stack.target.targetId`.
    targetId: 'mongo',
  });

  createMongoRuntime({
    context: ctx,
    driver: {} as never,
    // @ts-expect-error `contract` is not a property of MongoRuntimeOptions —
    // the contract is reached via `context.contract`.
    contract: {},
  });
});

declare const _options: MongoRuntimeOptions;
