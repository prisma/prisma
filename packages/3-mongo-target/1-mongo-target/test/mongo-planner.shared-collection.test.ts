import { describe, expect, it } from 'vitest';
import {
  contract,
  plan,
  planned,
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
