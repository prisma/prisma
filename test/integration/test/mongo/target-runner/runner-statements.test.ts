import { introspectSchema, MongoControlAdapterImpl } from '@internal/adapter-mongo/control';
import { asNamespaceId } from '@internal/contract/types';
import { MongoControlDriver } from '@internal/driver-mongo/control';
import type {
  MigrationOperationPolicy,
  MigrationPlan,
  ResolvedMigrationStatement,
} from '@internal/framework-components/control';
import { buildFabricatedMigrationEdge } from '@internal/migration-tools/aggregate';
import { MongoCollection, type MongoContract } from '@internal/mongo-contract';
import type { AnyMongoMigrationOperation } from '@internal/mongo-query-ast/control';
import {
  MongoMigrationPlanner,
  MongoMigrationRunner,
  serializeMongoOps,
} from '@internal/target-mongo/control';
import { timeouts } from '@repo/test-utils';
import { type Db, MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const controlAdapter = new MongoControlAdapterImpl();
const NS = asNamespaceId('__unbound__');
const policy: MigrationOperationPolicy = {
  allowedOperationClasses: ['additive', 'widening', 'destructive'],
};

let replSet: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;
const dbName = 'runner_statements_test';

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  client = new MongoClient(replSet.getUri());
  await client.connect();
  db = client.db(dbName);
}, timeouts.spinUpMongoMemoryServer);

afterAll(async () => {
  await client?.close();
  await replSet?.stop();
}, timeouts.spinUpMongoMemoryServer);

beforeEach(async () => {
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    await db.dropCollection(col['name'] as string);
  }
});

function closedSchema(fields: readonly string[]) {
  return {
    bsonType: 'object',
    required: ['_id', ...fields],
    properties: Object.fromEntries([
      ['_id', { bsonType: 'objectId' }],
      ...fields.map((field) => [field, { bsonType: 'string' }]),
    ]),
    additionalProperties: false,
  };
}

interface ModelSpec {
  readonly collection: string;
  readonly fields: readonly string[];
  readonly base?: string;
  readonly variants?: Readonly<Record<string, string>>;
}

function contract(
  storageHash: string,
  models: Readonly<Record<string, ModelSpec>>,
  collections: Readonly<Record<string, MongoCollection>>,
): MongoContract {
  return {
    target: 'mongo',
    targetFamily: 'mongo',
    profileHash: 'p1',
    capabilities: {},
    extensions: {},
    meta: {},
    roots: {},
    domain: {
      namespaces: {
        __unbound__: {
          models: Object.fromEntries(
            Object.entries(models).map(([name, spec]) => [
              name,
              {
                fields: Object.fromEntries(spec.fields.map((field) => [field, {}])),
                relations: {},
                storage: { collection: spec.collection },
                ...(spec.base === undefined
                  ? {}
                  : { base: { namespace: '__unbound__', model: spec.base } }),
                ...(spec.variants === undefined
                  ? {}
                  : {
                      discriminator: { field: 'type' },
                      variants: Object.fromEntries(
                        Object.entries(spec.variants).map(([variant, value]) => [
                          variant,
                          { value },
                        ]),
                      ),
                    }),
              },
            ]),
          ),
        },
      },
    },
    storage: {
      storageHash,
      namespaces: {
        __unbound__: {
          id: '__unbound__',
          kind: 'mongo-namespace',
          entries: { collection: collections },
        },
      },
    },
  } as unknown as MongoContract;
}

function closedCollection(fields: readonly string[], unique: readonly string[] = []) {
  return new MongoCollection({
    indexes: unique.map((field) => ({ keys: [{ field, direction: 1 as const }], unique: true })),
    validator: {
      jsonSchema: closedSchema(fields),
      validationLevel: 'strict',
      validationAction: 'error',
    },
  });
}

async function createClosed(
  name: string,
  fields: readonly string[],
  unique: readonly string[],
  documents: readonly Record<string, unknown>[],
) {
  await db.createCollection(name, {
    validator: { $jsonSchema: closedSchema(fields) },
    validationLevel: 'strict',
    validationAction: 'error',
  });
  for (const field of unique) {
    await db.collection(name).createIndex({ [field]: 1 }, { unique: true, name: `${field}_1` });
  }
  await db.collection(name).insertMany(documents.map((document) => ({ ...document })));
}

async function planAndRun(
  from: MongoContract,
  to: MongoContract,
  statements: readonly ResolvedMigrationStatement[] = [],
) {
  await controlAdapter.initMarker(new MongoControlDriver(db, client), 'app', {
    storageHash: from.storage.storageHash,
    profileHash: 'p1',
  });
  const planned = new MongoMigrationPlanner().plan({
    contract: to,
    schema: await introspectSchema(db),
    policy,
    fromContract: from,
    origin: { storageHash: from.storage.storageHash },
    statements,
    frameworkComponents: [],
    snapshotsImportPath: '../../snapshots',
  });
  if (planned.kind !== 'success') throw new Error(JSON.stringify(planned.conflicts, null, 2));
  const operations = planned.plan.operations as readonly AnyMongoMigrationOperation[];
  const plan: MigrationPlan = {
    targetId: 'mongo',
    operations: JSON.parse(serializeMongoOps(operations)),
    origin: { storageHash: from.storage.storageHash },
    destination: { storageHash: to.storage.storageHash },
  };
  const result = await new MongoMigrationRunner(
    controlAdapter.createRunnerDependencies(new MongoControlDriver(db, client)),
  ).execute({
    plan,
    migrationEdges: [
      buildFabricatedMigrationEdge({
        currentMarkerStorageHash: from.storage.storageHash,
        destinationStorageHash: to.storage.storageHash,
        operationCount: operations.length,
      }),
    ],
    destinationContract: to,
    policy,
    frameworkComponents: [],
  });
  return { planned, result };
}

async function furtherPlanLabels(to: MongoContract): Promise<readonly string[]> {
  const planned = new MongoMigrationPlanner().plan({
    contract: to,
    schema: await introspectSchema(db),
    policy,
    fromContract: to,
    origin: { storageHash: to.storage.storageHash },
    statements: [],
    frameworkComponents: [],
    snapshotsImportPath: '../../snapshots',
  });
  if (planned.kind !== 'success') throw new Error(JSON.stringify(planned.conflicts));
  return (planned.plan.operations as readonly AnyMongoMigrationOperation[]).map(
    (operation) => operation.label,
  );
}

async function documents(name: string) {
  return db
    .collection(name)
    .find({}, { projection: { _id: 0 }, sort: { _id: 1 } })
    .toArray();
}

describe('MongoMigrationPlanner and runner - statements', () => {
  it(
    'renames a model and a uniquely indexed field behind a closed validator, keeping every document',
    async () => {
      await createClosed('profiles', ['name'], ['name'], [{ name: 'Ada' }, { name: 'Bo' }]);
      const from = contract(
        'from',
        { Profile: { collection: 'profiles', fields: ['_id', 'name'] } },
        { profiles: closedCollection(['name'], ['name']) },
      );
      const to = contract(
        'to',
        { User: { collection: 'users', fields: ['_id', 'fullName'] } },
        { users: closedCollection(['fullName'], ['fullName']) },
      );

      const { planned, result } = await planAndRun(from, to, [
        {
          kind: 'rename',
          entity: 'model',
          from: { namespaceId: NS, model: 'Profile' },
          to: { namespaceId: NS, model: 'User' },
        },
        {
          kind: 'rename',
          entity: 'field',
          from: { namespaceId: NS, model: 'Profile', field: 'name' },
          to: { namespaceId: NS, model: 'User', field: 'fullName' },
        },
      ]);

      expect(result.ok ? result.value.operationsExecuted : result.failure).toBe(5);
      expect(planned.kind === 'success' ? planned.dataLoss : undefined).toEqual([]);
      expect({
        collections: (
          await db.listCollections({ name: { $in: ['profiles', 'users'] } }).toArray()
        ).map((c) => c.name),
        users: await documents('users'),
        further: await furtherPlanLabels(to),
      }).toEqual({
        collections: ['users'],
        users: [{ fullName: 'Ada' }, { fullName: 'Bo' }],
        further: [],
      });
      await expect(
        db.collection('users').updateOne({ fullName: 'Ada' }, { $set: { fullName: 'Ada L.' } }),
      ).resolves.toMatchObject({ modifiedCount: 1 });
      await expect(db.collection('users').insertOne({ fullName: 'Bo' })).rejects.toThrow(
        /duplicate key/,
      );
    },
    timeouts.spinUpMongoMemoryServer,
  );

  it(
    'removes a field the destination no longer has from every document',
    async () => {
      await createClosed(
        'users',
        ['email', 'nickname'],
        [],
        [
          { email: 'a@x', nickname: 'a' },
          { email: 'b@x', nickname: 'b' },
        ],
      );
      const from = contract(
        'from',
        { User: { collection: 'users', fields: ['_id', 'email', 'nickname'] } },
        { users: closedCollection(['email', 'nickname']) },
      );
      const to = contract(
        'to',
        { User: { collection: 'users', fields: ['_id', 'email'] } },
        { users: closedCollection(['email']) },
      );

      const { planned, result } = await planAndRun(from, to);

      expect(result.ok ? result.value.operationsExecuted : result.failure).toBe(2);
      expect(planned.kind === 'success' ? planned.dataLoss : undefined).toEqual([
        {
          operationIndex: 0,
          subject: { kind: 'field', namespaceId: NS, model: 'User', field: 'nickname' },
        },
      ]);
      expect({ users: await documents('users'), further: await furtherPlanLabels(to) }).toEqual({
        users: [{ email: 'a@x' }, { email: 'b@x' }],
        further: [],
      });
      await expect(
        db.collection('users').updateOne({ email: 'a@x' }, { $set: { email: 'a@y' } }),
      ).resolves.toMatchObject({ modifiedCount: 1 });
    },
    timeouts.spinUpMongoMemoryServer,
  );

  it(
    "renames a variant's field only in its own documents, so another variant's field of that name keeps its values",
    async () => {
      await db.collection('tasks').insertMany([
        { type: 'bug', score: 3 },
        { type: 'feature', score: 5 },
      ]);
      const tasks = (storageHash: string, bugField: string) =>
        contract(
          storageHash,
          {
            Task: {
              collection: 'tasks',
              fields: ['_id', 'type'],
              variants: { Bug: 'bug', Feature: 'feature' },
            },
            Bug: { collection: 'tasks', fields: [bugField], base: 'Task' },
            Feature: { collection: 'tasks', fields: ['score'], base: 'Task' },
          },
          { tasks: new MongoCollection({}) },
        );

      const { result } = await planAndRun(tasks('from', 'score'), tasks('to', 'severity'), [
        {
          kind: 'rename',
          entity: 'field',
          from: { namespaceId: NS, model: 'Bug', field: 'score' },
          to: { namespaceId: NS, model: 'Bug', field: 'severity' },
        },
      ]);

      expect(result.ok ? result.value.operationsExecuted : result.failure).toBe(1);
      expect(await documents('tasks')).toEqual([
        { type: 'bug', severity: 3 },
        { type: 'feature', score: 5 },
      ]);
    },
    timeouts.spinUpMongoMemoryServer,
  );
});
