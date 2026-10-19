import { type ControlPolicy, coreHash } from '@internal/contract/types';
import type { MigrationOperationPolicy } from '@internal/framework-components/control';
import {
  buildMongoNamespace,
  MongoCollection,
  type MongoCollectionInput,
  type MongoContract,
  MongoStorage,
} from '@internal/mongo-contract';
import type { MongoMigrationPlanOperation } from '@internal/mongo-query-ast/control';
import { MongoSchemaCollection, MongoSchemaIndex, MongoSchemaIR } from '@internal/mongo-schema-ir';
import { describe, expect, it } from 'vitest';
import { MongoMigrationPlanner } from '../src/core/migrations/mongo-planner';

const ALL_CLASSES_POLICY: MigrationOperationPolicy = {
  allowedOperationClasses: ['additive', 'widening', 'destructive'],
};

const declared: MongoCollectionInput = {
  indexes: [{ keys: [{ field: 'email', direction: 1 }], unique: true }],
  validator: {
    jsonSchema: { bsonType: 'object', properties: { email: { bsonType: 'string' } } },
    validationLevel: 'strict',
    validationAction: 'error',
  },
};

function contractOf(
  collections: Record<string, MongoCollectionInput>,
  defaultControlPolicy?: ControlPolicy,
): MongoContract {
  return {
    target: 'mongo',
    targetFamily: 'mongo',
    profileHash: 'test-profile',
    capabilities: {},
    extensions: {},
    meta: {},
    roots: {},
    domain: { namespaces: {} },
    ...(defaultControlPolicy === undefined ? {} : { defaultControlPolicy }),
    storage: new MongoStorage({
      storageHash: coreHash('test-storage'),
      namespaces: {
        __unbound__: buildMongoNamespace({
          id: '__unbound__',
          entries: {
            collection: Object.fromEntries(
              Object.entries(collections).map(([name, input]) => [
                name,
                new MongoCollection(input),
              ]),
            ),
          },
        }),
      },
    }),
  } as unknown as MongoContract;
}

function liveCollection(name: string, indexes: readonly MongoSchemaIndex[] = []) {
  return new MongoSchemaCollection({ name, indexes: [...indexes] });
}

function plannedCommands(contract: MongoContract, schema: MongoSchemaIR): readonly string[] {
  const result = new MongoMigrationPlanner().plan({
    contract,
    schema,
    policy: ALL_CLASSES_POLICY,
    fromContract: null,
    origin: null,
    statements: [],
    frameworkComponents: [],
    snapshotsImportPath: '../../snapshots',
  });
  if (result.kind !== 'success') throw new Error(JSON.stringify(result.conflicts));
  return (result.plan.operations as readonly MongoMigrationPlanOperation[]).map(
    (op) => `${op.execute[0]?.command.kind} ${op.execute[0]?.command.collection}`,
  );
}

describe('MongoMigrationPlanner under a collection control policy', () => {
  it('plans every change to a managed collection', () => {
    const contract = contractOf({ users: { ...declared, control: 'managed' } });

    expect(plannedCommands(contract, new MongoSchemaIR([liveCollection('users')]))).toEqual([
      'createIndex users',
      'collMod users',
    ]);
  });

  it.each(['external', 'observed'] as const)(
    'changes nothing in an existing %s collection',
    (control) => {
      const contract = contractOf({ users: { ...declared, control } });
      const live = liveCollection('users', [
        new MongoSchemaIndex({ keys: [{ field: 'legacy', direction: 1 }] }),
      ]);

      expect(plannedCommands(contract, new MongoSchemaIR([live]))).toEqual([]);
    },
  );

  it.each(['external', 'observed'] as const)(
    'does not create an absent %s collection',
    (control) => {
      const contract = contractOf({ users: { ...declared, control } });

      expect(plannedCommands(contract, new MongoSchemaIR([]))).toEqual([]);
    },
  );

  it('creates an absent tolerated collection with its indexes', () => {
    const contract = contractOf({ audit: { ...declared, control: 'tolerated' } });

    expect(plannedCommands(contract, new MongoSchemaIR([]))).toEqual([
      'createCollection audit',
      'createIndex audit',
    ]);
  });

  it('changes nothing in an existing tolerated collection', () => {
    const contract = contractOf({ audit: { ...declared, control: 'tolerated' } });

    expect(plannedCommands(contract, new MongoSchemaIR([liveCollection('audit')]))).toEqual([]);
  });

  it('does not drop a collection the contract leaves out under an external default policy', () => {
    const contract = contractOf({}, 'external');

    expect(plannedCommands(contract, new MongoSchemaIR([liveCollection('legacy')]))).toEqual([]);
  });
});
