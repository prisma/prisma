import type { PlanMeta } from '@internal/contract/types';
import type { CodecCallContext } from '@internal/framework-components/codec';
import { type MongoCodecRegistry, newMongoCodecRegistry } from '@internal/mongo-codec';
import type { MongoAdapter, MongoDriver, MongoLoweredDraft } from '@internal/mongo-lowering';
import type { MongoQueryPlan } from '@internal/mongo-query-ast/execution';
import { AggregateWireCommand, type AnyMongoDmlWireCommand } from '@internal/mongo-wire';
import { vi } from 'vitest';
import type {
  MongoExecutionContext,
  MongoExecutionStack,
  MongoRuntimeAdapterDescriptor,
  MongoRuntimeAdapterInstance,
  MongoRuntimeTargetDescriptor,
} from '../src/mongo-execution-stack';

export function makeContext(
  _adapter: MongoAdapter,
  wireCommand: AnyMongoDmlWireCommand = new AggregateWireCommand('users', []),
): MongoExecutionContext {
  const codecs: MongoCodecRegistry = newMongoCodecRegistry();
  const adapterInstance: MongoRuntimeAdapterInstance<'mongo'> = {
    familyId: 'mongo',
    targetId: 'mongo',
    lower: vi.fn(
      async () => wireCommand,
    ) as unknown as MongoRuntimeAdapterInstance<'mongo'>['lower'],
    structuralLower: vi.fn(
      (plan: MongoQueryPlan): MongoLoweredDraft => ({
        kind: 'rawAggregate',
        collection: plan.collection,
        pipeline: [],
      }),
    ),
    resolveParams: vi.fn(async (_draft: MongoLoweredDraft, _ctx: CodecCallContext) => wireCommand),
  };
  const target: MongoRuntimeTargetDescriptor<'mongo'> = {
    kind: 'target',
    id: 'mongo',
    familyId: 'mongo',
    targetId: 'mongo',
    version: '0.0.1',
    codecs: () => newMongoCodecRegistry(),
    create: () => ({ familyId: 'mongo', targetId: 'mongo' }),
  };
  const adapterDescriptor: MongoRuntimeAdapterDescriptor<'mongo'> = {
    kind: 'adapter',
    id: 'mongo',
    familyId: 'mongo',
    targetId: 'mongo',
    version: '0.0.1',
    codecs: () => newMongoCodecRegistry(),
    create: () => adapterInstance,
  };
  const stack: MongoExecutionStack<'mongo'> = {
    target,
    adapter: adapterDescriptor,
    driver: undefined,
    extensions: [],
  };
  return Object.freeze({ contract: {}, codecs, stack, applyMutationDefaults: () => [] });
}

export const baseMeta: PlanMeta = {
  target: 'mongo',
  targetFamily: 'mongo',
  storageHash: 'test',
  lane: 'orm',
};

export function createPlan(overrides?: Partial<MongoQueryPlan>): MongoQueryPlan {
  return {
    collection: 'users',
    command: { kind: 'find', filter: {} },
    meta: baseMeta,
    ...overrides,
  } as MongoQueryPlan;
}

export function createMockAdapter(): MongoAdapter {
  return {
    lower: vi.fn((plan: MongoQueryPlan) => ({
      collection: plan.collection,
      command: plan.command,
    })),
  } as unknown as MongoAdapter;
}

export function createMockDriver(rows: Record<string, unknown>[] = []): MongoDriver {
  return {
    execute: vi.fn(async function* <Row>() {
      for (const row of rows) {
        yield row as Row;
      }
    }),
    close: vi.fn(async () => {}),
  } as unknown as MongoDriver;
}
