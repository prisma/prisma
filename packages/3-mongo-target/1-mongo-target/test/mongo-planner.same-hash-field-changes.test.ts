import { describe, expect, it } from 'vitest';
import {
  contract,
  plan,
  planned,
  refusal,
  renameField,
  renameModel,
  schemaCollection,
} from './mongo-statement-fixtures';

const WHY =
  'The contract gives collection "profiles" no validator, so the names of its fields are not part of the contract\'s storage hash; a contract written in TypeScript has none yet. A migration that only renames or removes a field would start and end at the same hash, and db migrate refuses such a migration. Use prisma db update for this change instead: it carries the change out with the same --rename or --delete and writes no migration. Or write the migration by hand: run prisma migration new --from <hash of the migration the database is at>, and carry the change out in a dataTransform operation of its migration.ts, since db migrate accepts a migration that starts and ends at the same hash when it runs a dataTransform.';

const withName = contract(
  'same',
  { Profile: { collection: 'profiles', fields: ['_id', 'name', 'nickname'] } },
  { profiles: {} },
);
const schema = [schemaCollection('profiles')];
const migrationOrigin = { storageHash: withName.storage.storageHash };

describe('MongoMigrationPlanner, field changes that leave the storage hash unchanged', () => {
  it('refuses a field rename for a migration package', () => {
    const to = contract(
      'same',
      { Profile: { collection: 'profiles', fields: ['_id', 'fullName', 'nickname'] } },
      { profiles: {} },
    );
    expect(
      refusal(
        plan({
          from: withName,
          to,
          schema,
          origin: migrationOrigin,
          statements: [renameField('Profile', 'name', 'Profile', 'fullName')],
        }),
      ),
    ).toEqual([
      {
        kind: 'statementRefused',
        summary:
          'Cannot rename field "Profile.name" to "Profile.fullName": the migration would start and end at the same contract hash',
        why: WHY,
      },
    ]);
  });

  it('refuses a field removal for a migration package', () => {
    const to = contract(
      'same',
      { Profile: { collection: 'profiles', fields: ['_id', 'name'] } },
      { profiles: {} },
    );
    expect(refusal(plan({ from: withName, to, schema, origin: migrationOrigin }))).toEqual([
      {
        kind: 'fieldRemovalRefused',
        summary:
          'Cannot remove field "nickname" from collection "profiles": the migration would start and end at the same contract hash',
        why: WHY,
      },
    ]);
  });

  it('plans the same change for db update, which plans without an origin', () => {
    const to = contract(
      'same',
      { Profile: { collection: 'profiles', fields: ['_id', 'name'] } },
      { profiles: {} },
    );
    expect(planned(plan({ from: withName, to, schema })).labels).toEqual([
      'Remove field nickname from collection profiles',
    ]);
  });

  it('plans a model rename that changes the collection, whose name is in the hash', () => {
    const to = contract(
      'to',
      { User: { collection: 'users', fields: ['_id', 'name', 'nickname'] } },
      { users: {} },
    );
    expect(
      planned(
        plan({
          from: withName,
          to,
          schema,
          origin: migrationOrigin,
          statements: [renameModel('Profile', 'User')],
        }),
      ).labels,
    ).toEqual(['Rename collection profiles to users']);
  });
});
