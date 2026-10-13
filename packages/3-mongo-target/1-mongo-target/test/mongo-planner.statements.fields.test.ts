import type { ControlPolicy } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import {
  contract,
  NS,
  plan,
  planned,
  profiles,
  profilesSchema,
  renameField,
  renameModel,
  schemaCollection,
} from './mongo-statement-fixtures';

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
    ).toEqual([
      'Rename field score to severity in collection tasks in documents whose type is "bug"',
    ]);
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
      labels: ['Remove field score from collection tasks in documents whose type is "bug"'],
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
      labels: ['Remove field note from collection tasks in documents whose type is not "bug"'],
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
      labels: [
        'Rename field note to remark in collection tasks in documents whose type is not "bug"',
      ],
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

describe('MongoMigrationPlanner, removed fields in a collection that is not managed', () => {
  const schema = [schemaCollection('auth_users', { required: ['email', 'legacy'] })];
  const authUsers = (seed: string, fields: readonly string[], control: ControlPolicy) =>
    contract(
      seed,
      { AuthUser: { collection: 'auth_users', fields: ['_id', ...fields] } },
      { auth_users: { required: fields, control } },
    );

  for (const control of ['external', 'observed', 'tolerated'] as const) {
    it(`unsets nothing and asks nothing when the collection is ${control}`, () => {
      const result = planned(
        plan({
          from: authUsers('from', ['email', 'legacy'], control),
          to: authUsers('to', ['email'], control),
          schema,
        }),
      );
      const noOrigin = planned(
        plan({ from: null, to: authUsers('to', ['email'], control), schema }),
      );
      expect({
        unsets: [...result.labels, ...noOrigin.labels].filter((label) =>
          label.startsWith('Remove field'),
        ),
        dataLoss: [...result.dataLoss, ...noOrigin.dataLoss],
      }).toEqual({ unsets: [], dataLoss: [] });
    });
  }
});
