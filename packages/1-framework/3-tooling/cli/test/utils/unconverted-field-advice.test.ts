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

describe('the advice for a type change whose cast failed', () => {
  it('points db update to a migration with --convert, from the contract the database is at', () => {
    expect(
      mapDbUpdateFailure({
        ...runnerFailed,
        conflicts: undefined,
        failedCast: { field: 'User.age', reason: 'value' },
        databaseContract: FROM,
      }).fix,
    ).toBe(
      `A value of field "User.age" cannot be converted to its new type by the database's cast. Plan the change with \`{bin} migration plan --from ${FROM} --convert User.age\`, write the conversion in the migration.ts it writes, and apply it with \`{bin} db migrate\`.`,
    );
  });

  it('points db migrate to planning the failed migration again from its origin, keeping its statements and code, with --convert', () => {
    expect(
      mapMigrateFailure({
        ...runnerFailed,
        failedCast: { field: 'My Model.age', reason: 'value' },
        failedMigration: { directory: 'migrations/app/20261012T1041_lossy', from: FROM },
      }).fix,
    ).toBe(
      `A value of field "My Model.age" cannot be converted to its new type by the database's cast. The failed apply changed nothing. To convert it, copy any code you wrote in \`migrations/app/20261012T1041_lossy/migration.ts\`, delete \`migrations/app/20261012T1041_lossy\`, and plan it again with \`{bin} migration plan --from ${FROM} --convert 'My Model.age'\` and the statements you planned it with before. Then write that code and the new steps in the migration.ts it writes, and apply it with \`{bin} db migrate\`.`,
    );
  });

  it('says the database has no cast between the types when it has none', () => {
    expect([
      mapDbUpdateFailure({
        ...runnerFailed,
        conflicts: undefined,
        failedCast: { field: 'T.d', reason: 'noCast' },
      }).fix,
      mapMigrateFailure({ ...runnerFailed, failedCast: { field: 'T.d', reason: 'noCast' } }).fix,
    ]).toEqual([
      expect.stringMatching(
        /^The database has no cast from the old type of field "T\.d" to its new type\. Plan the change with `\{bin\} migration plan --convert T\.d`/,
      ),
      expect.stringMatching(
        /^The database has no cast from the old type of field "T\.d" to its new type\. Plan the type change again with `\{bin\} migration plan --convert T\.d`/,
      ),
    ]);
  });

  it('keeps the general advice for any other runner failure', () => {
    expect([
      mapDbUpdateFailure({ ...runnerFailed, conflicts: undefined }).fix,
      mapMigrateFailure(runnerFailed).fix,
    ]).toEqual([
      'Inspect the reported conflict, reconcile schema drift if needed, then re-run `{bin} db update`',
      'Fix the issue and re-run `{bin} db migrate --to <contract>` — previously applied migrations are preserved.',
    ]);
  });
});
