import { describe, expect, it } from 'vitest';
import { mapDbUpdateFailure } from '../../src/utils/db-update-failure';
import { mapMigrateFailure } from '../../src/utils/migrate-failure';

const runnerFailed = {
  code: 'RUNNER_FAILED',
  summary: 'Operation alterType.user.age failed during execution: alter type of "age"',
  why: 'invalid input syntax for type integer: "abc"',
  meta: {},
} as const;

const FROM = 'a'.repeat(64);
const PROJECT = '/work/app';
const FROM_PROJECT = { cwd: PROJECT, configPath: undefined };

describe('the advice for a type change whose cast failed', () => {
  it('points db update to a migration with --convert, from the contract the database is at', () => {
    expect(
      mapDbUpdateFailure(
        {
          ...runnerFailed,
          conflicts: undefined,
          failedCast: { field: 'User.age', reason: 'value' },
          databaseStorageHash: FROM,
        },
        FROM_PROJECT,
      ).fix,
    ).toBe(
      `A value of field "User.age" cannot be converted to its new type by the database's cast. Plan the change with \`{bin} migration plan --from ${FROM} --convert User.age\`, write the conversion in the migration.ts it writes, and apply it with \`{bin} db migrate\`.`,
    );
  });

  it('points db migrate to planning the failed migration again from its origin, keeping its statements and code, with --convert', () => {
    expect(
      mapMigrateFailure(
        {
          ...runnerFailed,
          failedCast: { field: 'My Model.age', reason: 'value' },
          failedMigration: {
            directory: `${PROJECT}/migrations/app/20261012T1041_lossy`,
            from: FROM,
          },
        },
        FROM_PROJECT,
      ).fix,
    ).toBe(
      `A value of field "My Model.age" cannot be converted to its new type by the database's cast. The failed apply changed nothing. To convert it, delete \`migrations/app/20261012T1041_lossy\` (copy any code you wrote in its migration.ts first), plan it again with \`{bin} migration plan --from ${FROM} --name lossy --convert 'My Model.age'\` and its other statements except \`--delete 'My Model.age'\`, fill in the migration.ts it writes, and run \`{bin} db migrate\`.`,
    );
  });

  it('says the database has no cast between the types when it has none', () => {
    expect([
      mapDbUpdateFailure(
        {
          ...runnerFailed,
          conflicts: undefined,
          failedCast: { field: 'T.d', reason: 'noCast' },
        },
        FROM_PROJECT,
      ).fix,
      mapMigrateFailure(
        { ...runnerFailed, failedCast: { field: 'T.d', reason: 'noCast' } },
        FROM_PROJECT,
      ).fix,
    ]).toEqual([
      expect.stringMatching(
        /^The database has no cast from the old type of field "T\.d" to its new type\. Plan the change with `\{bin\} migration plan --convert T\.d`/,
      ),
      expect.stringMatching(
        /^The database has no cast from the old type of field "T\.d" to its new type\. Plan the type change again with `\{bin\} migration plan --convert T\.d`/,
      ),
    ]);
  });

  it('points db migrate to the conversion in the failed migration when the conversion left a value the new type cannot hold', () => {
    expect(
      mapMigrateFailure(
        {
          ...runnerFailed,
          failedCast: { field: 'User.age', reason: 'conversion' },
          failedMigration: {
            directory: `${PROJECT}/migrations/app/20261012T1041_age`,
            from: FROM,
          },
        },
        FROM_PROJECT,
      ).fix,
    ).toBe(
      'The conversion of field "User.age" left a value its new type cannot hold. The failed apply changed nothing. Fix the conversion in `migrations/app/20261012T1041_age/migration.ts` so that it converts every value, run `node "migrations/app/20261012T1041_age/migration.ts"`, and re-run `{bin} db migrate`.',
    );
  });

  it('keeps the general advice for any other runner failure', () => {
    expect([
      mapDbUpdateFailure({ ...runnerFailed, conflicts: undefined }, FROM_PROJECT).fix,
      mapMigrateFailure(runnerFailed, FROM_PROJECT).fix,
    ]).toEqual([
      'Inspect the reported conflict, reconcile schema drift if needed, then re-run `{bin} db update`',
      'Fix the issue and re-run `{bin} db migrate --to <contract>` — previously applied migrations are preserved.',
    ]);
  });
});
