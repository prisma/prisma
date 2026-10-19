import { describe, expect, it } from 'vitest';
import {
  contract,
  plan,
  planned,
  refusal,
  renameField,
  schemaCollection,
  sharedJsonSchema,
} from './mongo-statement-fixtures';

const shared = (seed: string, admin: readonly string[], user: readonly string[]) =>
  contract(
    seed,
    {
      Admin: { collection: 'users', fields: ['_id', ...admin] },
      User: { collection: 'users', fields: ['_id', ...user] },
    },
    { users: { jsonSchema: sharedJsonSchema(admin, user) } },
  );

describe('MongoMigrationPlanner, a collection that stores several root models', () => {
  it('unsets nothing without an origin contract when the anyOf validator still declares the field', () => {
    expect(
      planned(
        plan({
          from: null,
          to: shared('to', ['level'], ['email']),
          schema: [schemaCollection('users', { required: ['level'] })],
        }),
      ),
    ).toEqual({
      labels: ['Update validator on users (added: email)'],
      classes: ['widening'],
      applied: [],
      dataLoss: [],
    });
  });

  it('unsets a field without an origin contract when no branch of the anyOf validator declares it', () => {
    expect(
      planned(
        plan({
          from: null,
          to: shared('to', ['level'], ['email']),
          schema: [
            schemaCollection('users', {
              jsonSchema: sharedJsonSchema(['level', 'nickname'], ['email']),
            }),
          ],
        }),
      ),
    ).toEqual({
      labels: [
        'Remove field nickname from collection users',
        'Update validator on users (removed: nickname)',
      ],
      classes: ['destructive', 'widening'],
      applied: [],
      dataLoss: [
        {
          operationIndex: 0,
          subject: { kind: 'storage', name: 'users.nickname' },
          loss: 'drop',
          label: 'Remove field nickname from collection users',
        },
      ],
    });
  });
});

const SEPARATE =
  'move the models to separate collections, or carry out the change in a dataTransform operation of a migration.ts, with a filter that selects only their documents';

describe('MongoMigrationPlanner, field changes in a collection that stores several root models', () => {
  const schema = [
    schemaCollection('users', { jsonSchema: sharedJsonSchema(['level'], ['level']) }),
  ];

  it('refuses to rename a field another root model of the collection stores', () => {
    expect(
      refusal(
        plan({
          from: shared('from', ['level'], ['level']),
          to: shared('to', ['rank'], ['level']),
          schema,
          statements: [renameField('Admin', 'level', 'Admin', 'rank')],
        }),
      ),
    ).toEqual([
      {
        kind: 'statementRefused',
        summary:
          'Cannot rename field "Admin.level" to "Admin.rank": model "User" stores field "level" in the same collection, "users"',
        why: `Collection "users" stores several models and no discriminator tells their documents apart, so renaming the field would rename it in the documents of "User" too. To change it, ${SEPARATE}.`,
      },
    ]);
  });

  it('renames a field no other root model of the collection stores', () => {
    expect(
      planned(
        plan({
          from: shared('from', ['level'], ['email']),
          to: shared('to', ['rank'], ['email']),
          schema: [
            schemaCollection('users', { jsonSchema: sharedJsonSchema(['level'], ['email']) }),
          ],
          statements: [renameField('Admin', 'level', 'Admin', 'rank')],
        }),
      ).labels[0],
    ).toBe('Rename field level to rank in collection users');
  });

  it('refuses to remove a field another root model of the collection still stores', () => {
    expect(
      refusal(
        plan({
          from: shared('from', ['level'], ['level']),
          to: shared('to', [], ['level']),
          schema,
        }),
      ),
    ).toEqual([
      {
        kind: 'fieldRemovalRefused',
        summary:
          'Cannot remove field "level" of model "Admin" from collection "users": model "User" stores it in the same collection',
        why: `Collection "users" stores several models and no discriminator tells their documents apart, so removing the field would remove it from the documents of "User" too. To keep it in "User" documents only, ${SEPARATE}.`,
      },
    ]);
  });

  it('removes nothing without an origin contract when another root model still declares the field', () => {
    expect(planned(plan({ from: null, to: shared('to', [], ['level']), schema })).dataLoss).toEqual(
      [],
    );
  });
});
