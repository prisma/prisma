import { asNamespaceId, type ControlPolicy } from '@internal/contract/types';
import type {
  MigrationOperationPolicy,
  ResolvedMigrationStatement,
} from '@internal/framework-components/control';
import { MongoCollection, type MongoContract } from '@internal/mongo-contract';
import {
  MongoSchemaCollection,
  MongoSchemaCollectionOptions,
  MongoSchemaIndex,
  MongoSchemaIR,
  MongoSchemaValidator,
} from '@internal/mongo-schema-ir';
import { describe, expect, it } from 'vitest';
import { MongoMigrationPlanner } from '../src/core/migrations/mongo-planner';
import type { PlannerProducedMongoMigration } from '../src/core/migrations/planner-produced-migration';

const ALL_CLASSES_POLICY: MigrationOperationPolicy = {
  allowedOperationClasses: ['additive', 'widening', 'destructive', 'data'],
};

const NS = asNamespaceId('__unbound__');

interface ModelSpec {
  readonly collection: string;
  readonly fields: readonly string[];
  readonly relations?: readonly string[];
  readonly base?: string;
  readonly discriminator?: string;
  readonly variants?: Readonly<Record<string, string>>;
}

interface CollectionSpec {
  readonly unique?: readonly string[];
  readonly required?: readonly string[];
  readonly control?: ControlPolicy;
  readonly timeField?: string;
}

function jsonSchema(fields: readonly string[]) {
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

function contract(
  seed: string,
  models: Readonly<Record<string, ModelSpec>>,
  collections: Readonly<Record<string, CollectionSpec>>,
): MongoContract {
  return {
    target: 'mongo',
    targetFamily: 'mongo',
    profileHash: 'test-profile',
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
                relations: Object.fromEntries(
                  (spec.relations ?? []).map((relation) => [
                    relation,
                    {
                      to: { model: 'Other', namespace: '__unbound__' },
                      cardinality: 'N:1',
                      on: { localFields: ['otherId'], targetFields: ['_id'] },
                    },
                  ]),
                ),
                storage: { collection: spec.collection },
                ...(spec.base === undefined
                  ? {}
                  : { base: { namespace: '__unbound__', model: spec.base } }),
                ...(spec.discriminator === undefined
                  ? {}
                  : {
                      discriminator: { field: spec.discriminator },
                      variants: Object.fromEntries(
                        Object.entries(spec.variants ?? {}).map(([variant, value]) => [
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
      storageHash: `storage-${seed}`,
      namespaces: {
        __unbound__: {
          id: '__unbound__',
          kind: 'mongo-namespace',
          entries: {
            collection: Object.fromEntries(
              Object.entries(collections).map(([name, spec]) => [
                name,
                new MongoCollection({
                  indexes: (spec.unique ?? []).map((field) => ({
                    keys: [{ field, direction: 1 as const }],
                    unique: true,
                  })),
                  ...(spec.required === undefined
                    ? {}
                    : {
                        validator: {
                          jsonSchema: jsonSchema(spec.required),
                          validationLevel: 'strict' as const,
                          validationAction: 'error' as const,
                        },
                      }),
                  ...(spec.control === undefined ? {} : { control: spec.control }),
                  ...(spec.timeField === undefined
                    ? {}
                    : { options: { timeseries: { timeField: spec.timeField } } }),
                }),
              ]),
            ),
          },
        },
      },
    },
  } as unknown as MongoContract;
}

function schemaCollection(
  name: string,
  spec: CollectionSpec & { readonly timeseries?: boolean } = {},
): MongoSchemaCollection {
  return new MongoSchemaCollection({
    name,
    indexes: (spec.unique ?? []).map(
      (field) => new MongoSchemaIndex({ keys: [{ field, direction: 1 }], unique: true }),
    ),
    ...(spec.required === undefined
      ? {}
      : {
          validator: new MongoSchemaValidator({
            jsonSchema: jsonSchema(spec.required),
            validationLevel: 'strict',
            validationAction: 'error',
          }),
        }),
    ...(spec.timeseries
      ? { options: new MongoSchemaCollectionOptions({ timeseries: { timeField: 'at' } }) }
      : {}),
  });
}

function plan(input: {
  readonly from: MongoContract | null;
  readonly to: MongoContract;
  readonly schema: readonly MongoSchemaCollection[];
  readonly statements?: readonly ResolvedMigrationStatement[];
  readonly policy?: MigrationOperationPolicy;
}) {
  return new MongoMigrationPlanner().plan({
    contract: input.to,
    schema: new MongoSchemaIR(input.schema),
    policy: input.policy ?? ALL_CLASSES_POLICY,
    fromContract: input.from,
    origin: null,
    statements: input.statements ?? [],
    frameworkComponents: [],
    snapshotsImportPath: '../../snapshots',
  });
}

function planned(result: ReturnType<typeof plan>) {
  if (result.kind !== 'success') throw new Error(JSON.stringify(result.conflicts, null, 2));
  const operations = (result.plan as PlannerProducedMongoMigration).operations;
  return {
    labels: operations.map((operation) => operation.label),
    classes: operations.map((operation) => operation.operationClass),
    applied: result.appliedStatements.map((applied) => applied.operationIndexes),
    dataLoss: result.dataLoss,
  };
}

function refusal(result: ReturnType<typeof plan>) {
  if (result.kind !== 'failure') throw new Error('Expected the plan to be refused');
  return result.conflicts.map(({ kind, summary, why }) => ({ kind, summary, why }));
}

const renameModel = (from: string, to: string): ResolvedMigrationStatement => ({
  kind: 'rename',
  entity: 'model',
  from: { namespaceId: NS, model: from },
  to: { namespaceId: NS, model: to },
});

const renameField = (
  fromModel: string,
  from: string,
  toModel: string,
  to: string,
): ResolvedMigrationStatement => ({
  kind: 'rename',
  entity: 'field',
  from: { namespaceId: NS, model: fromModel, field: from },
  to: { namespaceId: NS, model: toModel, field: to },
});

const profiles = contract(
  'from',
  { Profile: { collection: 'profiles', fields: ['_id', 'name'] } },
  { profiles: { unique: ['name'], required: ['name'] } },
);
const users = contract(
  'to',
  { User: { collection: 'users', fields: ['_id', 'name'] } },
  { users: { unique: ['name'], required: ['name'] } },
);
const profilesSchema = [schemaCollection('profiles', { unique: ['name'], required: ['name'] })];

describe('MongoMigrationPlanner, model statements', () => {
  it('without a statement, drops the old collection and creates the new one', () => {
    expect(planned(plan({ from: profiles, to: users, schema: profilesSchema })).labels).toEqual([
      'Create collection users',
      'Drop index on profiles (name:1)',
      'Create index on users (name:1)',
      'Drop collection profiles',
    ]);
  });

  it('renames the collection, which keeps its indexes and validator, and reports the rename applied', () => {
    expect(
      planned(
        plan({
          from: profiles,
          to: users,
          schema: profilesSchema,
          statements: [renameModel('Profile', 'User')],
        }),
      ),
    ).toEqual({
      labels: ['Rename collection profiles to users'],
      classes: ['widening'],
      applied: [[0]],
      dataLoss: [],
    });
  });

  it('plans nothing for a model whose collection keeps its name', () => {
    const to = contract(
      'to',
      { User: { collection: 'profiles', fields: ['_id', 'name'] } },
      { profiles: { unique: ['name'], required: ['name'] } },
    );
    expect(
      planned(
        plan({
          from: profiles,
          to,
          schema: profilesSchema,
          statements: [renameModel('Profile', 'User')],
        }),
      ),
    ).toEqual({ labels: [], classes: [], applied: [[]], dataLoss: [] });
  });
});

describe('MongoMigrationPlanner, field statements', () => {
  const fullName = contract(
    'to',
    { Profile: { collection: 'profiles', fields: ['_id', 'fullName'] } },
    { profiles: { unique: ['fullName'], required: ['fullName'] } },
  );

  it('renames the field between the index drop and the index create, before the validator update', () => {
    expect(
      planned(
        plan({
          from: profiles,
          to: fullName,
          schema: profilesSchema,
          statements: [renameField('Profile', 'name', 'Profile', 'fullName')],
        }),
      ),
    ).toEqual({
      labels: [
        'Drop index on profiles (name:1)',
        'Rename field name to fullName in collection profiles',
        'Create index on profiles (fullName:1)',
        'Update validator on profiles (added: fullName; removed: name)',
      ],
      classes: ['widening', 'widening', 'additive', 'widening'],
      applied: [[1]],
      dataLoss: [],
    });
  });

  it('renames the collection first, then the field in the renamed collection', () => {
    const to = contract(
      'to',
      { User: { collection: 'users', fields: ['_id', 'fullName'] } },
      { users: { unique: ['fullName'], required: ['fullName'] } },
    );
    expect(
      planned(
        plan({
          from: profiles,
          to,
          schema: profilesSchema,
          statements: [
            renameModel('Profile', 'User'),
            renameField('Profile', 'name', 'User', 'fullName'),
          ],
        }),
      ),
    ).toMatchObject({
      labels: [
        'Rename collection profiles to users',
        'Drop index on users (name:1)',
        'Rename field name to fullName in collection users',
        'Create index on users (fullName:1)',
        'Update validator on users (added: fullName; removed: name)',
      ],
      applied: [[0], [2]],
      dataLoss: [],
    });
  });

  it("renames a variant's field only in that variant's documents", () => {
    const tasks = (bugField: string) =>
      contract(
        bugField,
        {
          Task: {
            collection: 'tasks',
            fields: ['_id', 'type'],
            discriminator: 'type',
            variants: { Bug: 'bug', Feature: 'feature' },
          },
          Bug: { collection: 'tasks', fields: [bugField], base: 'Task' },
          Feature: { collection: 'tasks', fields: ['score'], base: 'Task' },
        },
        { tasks: {} },
      );
    expect(
      planned(
        plan({
          from: tasks('score'),
          to: tasks('severity'),
          schema: [schemaCollection('tasks')],
          statements: [renameField('Bug', 'score', 'Bug', 'severity')],
        }),
      ).labels,
    ).toEqual(['Rename field score to severity in collection tasks where {"type":"bug"}']);
  });

  it('plans nothing for a relation renamed to another relation, which documents do not store', () => {
    const withRelation = (relation: string) =>
      contract(
        relation,
        { Profile: { collection: 'profiles', fields: ['_id', 'name'], relations: [relation] } },
        { profiles: { unique: ['name'], required: ['name'] } },
      );
    expect(
      planned(
        plan({
          from: withRelation('owner'),
          to: withRelation('author'),
          schema: profilesSchema,
          statements: [renameField('Profile', 'owner', 'Profile', 'author')],
        }),
      ),
    ).toEqual({ labels: [], classes: [], applied: [[]], dataLoss: [] });
  });
});

describe('MongoMigrationPlanner, statements it refuses', () => {
  it('refuses renaming _id', () => {
    const to = contract(
      'to',
      { Profile: { collection: 'profiles', fields: ['key', 'name'] } },
      { profiles: { unique: ['name'], required: ['name'] } },
    );
    expect(
      refusal(
        plan({
          from: profiles,
          to,
          schema: profilesSchema,
          statements: [renameField('Profile', '_id', 'Profile', 'key')],
        }),
      ),
    ).toEqual([
      {
        kind: 'statementRefused',
        summary: 'Cannot rename field "Profile._id" to "Profile.key": it renames _id',
        why: 'MongoDB does not let a document change its _id. Leave out this statement.',
      },
    ]);
  });

  it('refuses renaming a stored field whose name MongoDB reads as a path, and says to rename it by hand', () => {
    const named = (field: string) =>
      contract(
        field,
        { Profile: { collection: 'profiles', fields: ['_id', field] } },
        { profiles: {} },
      );
    expect(
      refusal(
        plan({
          from: named('o.d'),
          to: named('od'),
          schema: [schemaCollection('profiles')],
          statements: [renameField('Profile', 'o.d', 'Profile', 'od')],
        }),
      ),
    ).toEqual([
      {
        kind: 'statementRefused',
        summary:
          'Cannot rename field "Profile.o.d" to "Profile.od": the stored field name "o.d" cannot be rewritten',
        why: 'MongoDB reads a name containing "." as a path into embedded documents, so a statement cannot move its values. Rename it in the database yourself, or leave out this statement.',
      },
    ]);
  });

  it('refuses a stored field name MongoDB reads as a path or an operator', () => {
    const to = (field: string) =>
      contract(
        field,
        { Profile: { collection: 'profiles', fields: ['_id', field] } },
        { profiles: {} },
      );
    expect(
      ['a.b', '$a'].flatMap((field) =>
        refusal(
          plan({
            from: to('name'),
            to: to(field),
            schema: [schemaCollection('profiles')],
            statements: [renameField('Profile', 'name', 'Profile', field)],
          }),
        ).map(({ summary }) => summary),
      ),
    ).toEqual([
      'Cannot rename field "Profile.name" to "Profile.a.b": the stored field name "a.b" cannot be written',
      'Cannot rename field "Profile.name" to "Profile.$a": the stored field name "$a" cannot be written',
    ]);
  });

  it('refuses renaming a time-series collection, a collection the schema does not have, and onto a name it already has', () => {
    const statements = [renameModel('Profile', 'User')];
    expect(
      [
        [schemaCollection('profiles', { unique: ['name'], required: ['name'], timeseries: true })],
        [],
        [...profilesSchema, schemaCollection('users')],
      ].flatMap((schema) =>
        refusal(plan({ from: profiles, to: users, schema, statements })).map(
          ({ summary }) => summary,
        ),
      ),
    ).toEqual([
      'Cannot rename model "Profile" to "User": collection "profiles" is a time-series collection',
      'Cannot rename model "Profile" to "User": the schema being planned from has no collection "profiles"',
      'Cannot rename model "Profile" to "User": the schema being planned from already has a collection "users"',
    ]);
  });

  it('refuses a collection name MongoDB rejects', () => {
    const to = (collection: string) =>
      contract('to', { User: { collection, fields: ['_id', 'name'] } }, { [collection]: {} });
    expect(
      ['a$b', 'system.users', 'a\0b'].flatMap((collection) =>
        refusal(
          plan({
            from: profiles,
            to: to(collection),
            schema: profilesSchema,
            statements: [renameModel('Profile', 'User')],
          }),
        ).map(({ summary }) => summary),
      ),
    ).toEqual([
      'Cannot rename model "Profile" to "User": MongoDB does not accept the collection name "a$b": it contains "$"',
      'Cannot rename model "Profile" to "User": MongoDB does not accept the collection name "system.users": it starts with "system.", which MongoDB reserves',
      'Cannot rename model "Profile" to "User": MongoDB does not accept the collection name "a\0b": it contains a null character',
    ]);
  });

  it('refuses a field stored on one side of the statement only', () => {
    const to = contract(
      'to',
      { Profile: { collection: 'profiles', fields: ['_id', 'name'], relations: ['owner'] } },
      { profiles: { unique: ['name'], required: ['name'] } },
    );
    const from = contract(
      'from',
      { Profile: { collection: 'profiles', fields: ['_id', 'name', 'ownerName'] } },
      { profiles: { unique: ['name'], required: ['name'] } },
    );
    expect(
      refusal(
        plan({
          from,
          to,
          schema: profilesSchema,
          statements: [renameField('Profile', 'ownerName', 'Profile', 'owner')],
        }),
      ).map(({ summary }) => summary),
    ).toEqual([
      'Cannot rename field "Profile.ownerName" to "Profile.owner": the field is stored in documents on one side of the statement only',
    ]);
  });

  it('refuses a statement on a collection whose control policy is not managed', () => {
    const to = contract(
      'to',
      { User: { collection: 'users', fields: ['_id', 'name'] } },
      { users: { unique: ['name'], required: ['name'], control: 'external' } },
    );
    expect(
      refusal(
        plan({
          from: profiles,
          to,
          schema: profilesSchema,
          statements: [renameModel('Profile', 'User')],
        }),
      ).map(({ summary }) => summary),
    ).toEqual([
      'Cannot rename model "Profile" to "User": collection "users" has control policy "external"',
    ]);
  });

  it("refuses a field rename when the model's collection changes and no statement renames it", () => {
    const to = contract(
      'to',
      { Profile: { collection: 'users', fields: ['_id', 'fullName'] } },
      { users: {} },
    );
    expect(
      refusal(
        plan({
          from: profiles,
          to,
          schema: profilesSchema,
          statements: [renameField('Profile', 'name', 'Profile', 'fullName')],
        }),
      ).map(({ summary }) => summary),
    ).toEqual([
      'Cannot rename field "Profile.name" to "Profile.fullName": the model\'s collection changes from "profiles" to "users", and no statement renames it',
    ]);
    expect(
      refusal(
        plan({
          from: profiles,
          to,
          schema: profilesSchema,
          statements: [renameField('Profile', 'name', 'Profile', 'fullName')],
        }),
      )[0]?.why,
    ).toBe(
      'A statement cannot rename the collection of a model that keeps its name. Rename the collection in a step of its own first: change only @@map and emit the contract. With db update, rename the collection in the database yourself, for example db.getCollection("profiles").renameCollection("users") in mongosh, then run db update. With migration plan, plan it, passing --delete Profile to answer its question; in its migration.ts replace the drop of "profiles" and the create of "users" with renameCollection("profiles", "users"), imported with the other operations; run node migration.ts in the migration\'s directory, so it writes ops.json again; then apply it with migrate. Then change the field and run this statement again.',
    );
  });
});

describe('MongoMigrationPlanner, removed fields', () => {
  const withoutName = contract(
    'to',
    { Profile: { collection: 'profiles', fields: ['_id', 'email'] } },
    { profiles: { required: ['email'] } },
  );
  const from = contract(
    'from',
    { Profile: { collection: 'profiles', fields: ['_id', 'email', 'name'] } },
    { profiles: { required: ['email', 'name'] } },
  );
  const schema = [schemaCollection('profiles', { required: ['email', 'name'] })];

  it('unsets a removed field from every document and reports the field as lost', () => {
    expect(planned(plan({ from, to: withoutName, schema }))).toEqual({
      labels: [
        'Remove field name from collection profiles',
        'Update validator on profiles (removed: name)',
      ],
      classes: ['destructive', 'widening'],
      applied: [],
      dataLoss: [
        {
          operationIndex: 0,
          subject: { kind: 'field', namespaceId: NS, model: 'Profile', field: 'name' },
        },
      ],
    });
  });

  it('names the field by its storage name when the origin contract is unknown', () => {
    expect(planned(plan({ from: null, to: withoutName, schema })).dataLoss).toEqual([
      { operationIndex: 0, subject: { kind: 'storage', name: 'profiles.name' } },
    ]);
  });

  it('unsets nothing when the collection is dropped', () => {
    const none = contract('to', {}, {});
    expect(planned(plan({ from, to: none, schema })).labels).toEqual(['Drop collection profiles']);
  });

  const tasks = (
    seed: string,
    baseFields: readonly string[],
    bugFields: readonly string[],
    featureFields: readonly string[],
  ) =>
    contract(
      seed,
      {
        Task: {
          collection: 'tasks',
          fields: ['_id', 'type', ...baseFields],
          discriminator: 'type',
          variants: { Bug: 'bug', Feature: 'feature' },
        },
        Bug: { collection: 'tasks', fields: bugFields, base: 'Task' },
        Feature: { collection: 'tasks', fields: featureFields, base: 'Task' },
      },
      { tasks: {} },
    );

  it("unsets a variant's removed field only from that variant's documents", () => {
    expect(
      planned(
        plan({
          from: tasks('from', [], ['score', 'severity'], ['score']),
          to: tasks('to', [], ['severity'], ['score']),
          schema: [schemaCollection('tasks')],
        }),
      ),
    ).toMatchObject({
      labels: ['Remove field score from collection tasks where {"type":"bug"}'],
      dataLoss: [
        {
          operationIndex: 0,
          subject: { kind: 'field', namespaceId: NS, model: 'Bug', field: 'score' },
        },
      ],
    });
  });

  it('unsets a base field moved to one variant from the documents of every other variant', () => {
    expect(
      planned(
        plan({
          from: tasks('from', ['note'], [], []),
          to: tasks('to', [], ['note'], []),
          schema: [schemaCollection('tasks')],
        }),
      ),
    ).toMatchObject({
      labels: ['Remove field note from collection tasks where {"type":{"$nin":["bug"]}}'],
      dataLoss: [
        {
          operationIndex: 0,
          subject: { kind: 'field', namespaceId: NS, model: 'Task', field: 'note' },
        },
      ],
    });
  });

  it('renames a base field moved to one variant only in the documents of the other variants', () => {
    expect(
      planned(
        plan({
          from: tasks('from', ['note'], [], []),
          to: tasks('to', ['remark'], ['note'], []),
          schema: [schemaCollection('tasks')],
          statements: [renameField('Task', 'note', 'Task', 'remark')],
        }),
      ),
    ).toMatchObject({
      labels: ['Rename field note to remark in collection tasks where {"type":{"$nin":["bug"]}}'],
      applied: [[0]],
      dataLoss: [],
    });
  });

  it('keeps a variant field its base now stores', () => {
    expect(
      planned(
        plan({
          from: tasks('from', [], ['note'], []),
          to: tasks('to', ['note'], [], []),
          schema: [schemaCollection('tasks')],
        }),
      ).labels,
    ).toEqual([]);
  });

  it('unsets nothing without an origin contract when the destination collection has no validator', () => {
    const unvalidated = contract(
      'to',
      { Profile: { collection: 'profiles', fields: ['_id', 'email'] } },
      { profiles: {} },
    );
    expect(planned(plan({ from: null, to: unvalidated, schema })).labels).toEqual([
      'Remove validator on profiles',
    ]);
  });

  it('unsets nothing for a field a statement renames', () => {
    const fullName = contract(
      'to',
      { Profile: { collection: 'profiles', fields: ['_id', 'email', 'fullName'] } },
      { profiles: { required: ['email', 'fullName'] } },
    );
    expect(
      planned(
        plan({
          from,
          to: fullName,
          schema,
          statements: [renameField('Profile', 'name', 'Profile', 'fullName')],
        }),
      ).dataLoss,
    ).toEqual([]);
  });
});

describe('MongoMigrationPlanner, time-series options the server fills in', () => {
  it('plans nothing when the live collection holds only server defaults the contract leaves out', () => {
    const readings = contract(
      'to',
      { Reading: { collection: 'readings', fields: ['_id', 'at'] } },
      { readings: { timeField: 'at' } },
    );
    const serverFilled = {
      timeField: 'at',
      granularity: 'seconds' as const,
      bucketMaxSpanSeconds: 3600,
    };
    const live = new MongoSchemaCollection({
      name: 'readings',
      options: new MongoSchemaCollectionOptions({ timeseries: serverFilled }),
    });
    expect(planned(plan({ from: readings, to: readings, schema: [live] })).labels).toEqual([]);
  });
});
