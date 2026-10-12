import { describe, expect, it } from 'vitest';
import { mapDbUpdateFailure } from '../../src/utils/db-update-failure';
import { mapMigrateFailure } from '../../src/utils/migrate-failure';

const runnerFailed = {
  code: 'RUNNER_FAILED',
  summary: 'Operation alterType.user.age failed during execution: alter type of "age"',
  why: 'invalid input syntax for type integer: "abc"',
  meta: {},
} as const;

describe('the advice for a type change that met a value it could not convert', () => {
  it('points db update to a migration with --convert', () => {
    expect(
      mapDbUpdateFailure({ ...runnerFailed, conflicts: undefined, unconvertedField: 'User.age' })
        .fix,
    ).toBe(
      'A value of field "User.age" cannot be converted to its new type by the database\'s cast. Plan the change with `{bin} migration plan --convert User.age`, write the conversion in the migration.ts it writes, and apply it with `{bin} db migrate`.',
    );
  });

  it('points db migrate to planning the type change again with --convert', () => {
    expect(mapMigrateFailure({ ...runnerFailed, unconvertedField: 'My Model.age' }).fix).toBe(
      "A value of field \"My Model.age\" cannot be converted to its new type by the database's cast. Plan the type change again with `{bin} migration plan --convert 'My Model.age'` in place of this migration, and write the conversion in the migration.ts it writes.",
    );
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
