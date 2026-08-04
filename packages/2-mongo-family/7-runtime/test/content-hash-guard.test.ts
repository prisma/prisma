import mongoRuntimeAdapter from '@internal/adapter-mongo/runtime';
import type { PlanMeta } from '@internal/contract/types';
import { isRuntimeError } from '@internal/framework-components/runtime';
import type { MongoDriver, MongoLoweredDraft } from '@internal/mongo-lowering';
import { InsertOneCommand } from '@internal/mongo-query-ast/execution';
import { MongoParamRef } from '@internal/mongo-value';
import type { AnyMongoWireCommand } from '@internal/mongo-wire';
import mongoRuntimeTarget from '@internal/target-mongo/runtime';
import { blindCast } from '@internal/utils/casts';
import { describe, expect, it, vi } from 'vitest';
import { computeMongoContentHash } from '../src/content-hash';
import type { MongoExecutionPlan } from '../src/mongo-execution-plan';
import {
  createMongoExecutionContext,
  createMongoExecutionStack,
} from '../src/mongo-execution-stack';
import type { MongoMiddleware } from '../src/mongo-middleware';
import { createMongoRuntime } from '../src/mongo-runtime';

const baseMeta: PlanMeta = {
  target: 'mongo',
  targetFamily: 'mongo',
  storageHash: 'test',
  lane: 'orm',
};

function buildDraftExec(draft: MongoLoweredDraft): MongoExecutionPlan {
  return {
    meta: baseMeta,
    command: blindCast<
      MongoExecutionPlan['command'],
      'pre-resolve draft placed in command slot for guard tests'
    >(draft),
  };
}

describe('computeMongoContentHash unresolved-command guard', () => {
  it('throws RUNTIME.CONTENT_HASH_REQUIRES_RESOLVED_COMMAND for a structural draft in the command slot', async () => {
    const draft: MongoLoweredDraft = {
      kind: 'insertOne',
      collection: 'users',
      document: { name: new MongoParamRef('Alice') },
    };

    await expect(async () => computeMongoContentHash(buildDraftExec(draft))).rejects.toSatisfy(
      (error) => {
        if (!isRuntimeError(error)) return false;
        return (
          error.code === 'RUNTIME.CONTENT_HASH_REQUIRES_RESOLVED_COMMAND' &&
          error.message.includes('contentHash') &&
          error.message.includes('resolved wire command') &&
          error.message.includes('beforeExecute')
        );
      },
    );
  });

  it.each([
    { label: 'null', command: null },
    { label: 'a primitive', command: 'not-a-command' },
  ])(
    'throws when the command slot holds $label rather than a wire command',
    async ({ command }) => {
      const exec: MongoExecutionPlan = {
        meta: baseMeta,
        command: blindCast<
          MongoExecutionPlan['command'],
          'non-object command slot for guard tests'
        >(command),
      };

      await expect(async () => computeMongoContentHash(exec)).rejects.toSatisfy((error) => {
        if (!isRuntimeError(error)) return false;
        return error.code === 'RUNTIME.CONTENT_HASH_REQUIRES_RESOLVED_COMMAND';
      });
    },
  );

  it('throws the same code when beforeExecute calls ctx.contentHash on the pre-resolve plan', async () => {
    const middleware: MongoMiddleware = {
      name: 'hash-too-early',
      async beforeExecute(plan, ctx) {
        await ctx.contentHash(plan);
      },
    };

    const stack = createMongoExecutionStack({
      target: mongoRuntimeTarget,
      adapter: mongoRuntimeAdapter,
    });
    const context = createMongoExecutionContext({ contract: {}, stack });
    const driver = {
      execute: vi.fn(async function* (_command: AnyMongoWireCommand) {
        yield { insertedId: 'x' };
      }),
      close: vi.fn(async () => {}),
    } as unknown as MongoDriver;
    const runtime = createMongoRuntime({
      context,
      driver,
      middleware: [middleware],
    });

    await expect(
      runtime
        .execute({
          collection: 'users',
          command: new InsertOneCommand('users', { name: new MongoParamRef('Alice') }),
          meta: baseMeta,
        })
        .toArray(),
    ).rejects.toSatisfy((error) => {
      if (!isRuntimeError(error)) return false;
      return error.code === 'RUNTIME.CONTENT_HASH_REQUIRES_RESOLVED_COMMAND';
    });
  });
});
