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
const FROM_PROJECT = { cwd: PROJECT, configPath: undefined, dbGiven: false };

describe('the advice for a type change whose cast failed', () => {
  it('points db update to a migration with --convert, from the contract the database is at', () => {
    expect(
      mapDbUpdateFailure(
        {
          ...runnerFailed,
          conflicts: undefined,
          failedTypeChange: { field: 'User.age', by: 'cast', reason: 'value' },
          databaseStorageHash: FROM,
        },
        FROM_PROJECT,
      ).fix,
    ).toBe(
      `A value of field "User.age" cannot be converted to its new type by the database's cast. Plan the change with \`{bin} migration plan --from ${FROM} --convert User.age\`, write the conversion in the migration.ts it writes, run that migration.ts with the \`node\` command \`migration plan\` prints, and apply it with \`{bin} db migrate\`.`,
    );
  });

  it('points db migrate to planning the failed migration again from its origin, keeping its statements and code, with --convert', () => {
    expect(
      mapMigrateFailure(
        {
          ...runnerFailed,
          failedTypeChange: { field: 'My Model.age', by: 'cast', reason: 'value' },
          failedMigration: {
            directory: `${PROJECT}/migrations/app/20261012T1041_lossy`,
            from: FROM,
          },
        },
        FROM_PROJECT,
      ).fix,
    ).toBe(
      `A value of field "My Model.age" cannot be converted to its new type by the database's cast. The failed apply changed nothing. To convert it, delete \`migrations/app/20261012T1041_lossy\` (copy any code you wrote in its migration.ts first), plan it again with \`{bin} migration plan --from ${FROM} --name lossy --convert 'My Model.age'\` and its other statements except \`--delete 'My Model.age'\`, fill in the migration.ts it writes, run that migration.ts with the \`node\` command \`migration plan\` prints, and run \`{bin} db migrate\`.`,
    );
  });

  it('says the database has no cast between the types when it has none', () => {
    expect([
      mapDbUpdateFailure(
        {
          ...runnerFailed,
          conflicts: undefined,
          failedTypeChange: { field: 'T.d', by: 'cast', reason: 'noCast' },
        },
        FROM_PROJECT,
      ).fix,
      mapMigrateFailure(
        { ...runnerFailed, failedTypeChange: { field: 'T.d', by: 'cast', reason: 'noCast' } },
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
          failedTypeChange: { field: 'User.age', by: 'conversion', reason: 'invalidResult' },
          failedMigration: {
            directory: `${PROJECT}/migrations/app/20261012T1041_age`,
            from: FROM,
          },
        },
        FROM_PROJECT,
      ).fix,
    ).toBe(
      'The conversion of field "User.age" left a value its new type cannot hold. The failed apply changed nothing. Fix the conversion in `migrations/app/20261012T1041_age/migration.ts`, run `node migrations/app/20261012T1041_age/migration.ts`, and re-run `{bin} db migrate`.',
    );
  });

  it('says to run the migration.ts with node before db migrate when the failed migration is unknown', () => {
    expect(
      mapMigrateFailure(
        { ...runnerFailed, failedTypeChange: { field: 'T.d', by: 'cast', reason: 'noCast' } },
        FROM_PROJECT,
      ).fix,
    ).toBe(
      'The database has no cast from the old type of field "T.d" to its new type. Plan the type change again with `{bin} migration plan --convert T.d`, write the conversion in the migration.ts it writes, run that migration.ts with the `node` command `migration plan` prints, and apply it with `{bin} db migrate`.',
    );
  });

  it('says whether the conversion failed on a value, left one, or has an error in its SQL', () => {
    const advice = (reason: 'value' | 'invalidResult' | 'sqlError') =>
      mapMigrateFailure(
        {
          ...runnerFailed,
          failedTypeChange: { field: 'User.age', by: 'conversion', reason },
          failedMigration: { directory: `${PROJECT}/migrations/app/20261012T1041_age`, from: FROM },
        },
        { cwd: PROJECT, configPath: 'prisma.config.ts', dbGiven: true },
      ).fix;
    const rest =
      ' The failed apply changed nothing. Fix the conversion in `migrations/app/20261012T1041_age/migration.ts`, run `node migrations/app/20261012T1041_age/migration.ts --config prisma.config.ts`, and re-run `{bin} db migrate --config prisma.config.ts --db <url>`.';
    expect([advice('value'), advice('invalidResult'), advice('sqlError')]).toEqual([
      `The conversion of field "User.age" failed on a value its new type cannot hold.${rest}`,
      `The conversion of field "User.age" left a value its new type cannot hold.${rest}`,
      `The conversion of field "User.age" failed with an error in its SQL.${rest}`,
    ]);
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

  it('repeats --config and --db in the general advice', () => {
    const invocation = { cwd: '/work', configPath: 'app/prisma.config.ts', dbGiven: true };
    expect([
      mapDbUpdateFailure({ ...runnerFailed, conflicts: undefined }, invocation).fix,
      mapMigrateFailure(runnerFailed, invocation).fix,
    ]).toEqual([
      'Inspect the reported conflict, reconcile schema drift if needed, then re-run `{bin} db update --config app/prisma.config.ts --db <url>`',
      'Fix the issue and re-run `{bin} db migrate --to <contract> --config app/prisma.config.ts --db <url>` — previously applied migrations are preserved.',
    ]);
  });
});
