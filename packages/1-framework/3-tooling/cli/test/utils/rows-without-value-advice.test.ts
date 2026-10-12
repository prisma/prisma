import { describe, expect, it } from 'vitest';
import { mapDbInitFailure } from '../../src/utils/db-init-failure';
import { mapDbUpdateFailure } from '../../src/utils/db-update-failure';
import { mapMigrateFailure } from '../../src/utils/migrate-failure';

const runnerFailed = {
  code: 'RUNNER_FAILED',
  summary: '3 rows of "Item" hold NULL in "note", so it cannot become required.',
  why: 'Operation alterNullability.setNotNull.Item.note failed during precheck: ensure no NULL values in "note"',
  meta: {},
} as const;

const FROM = 'b'.repeat(64);
const failedMigration = { directory: 'migrations/app/20261012T1200_note', from: FROM };

describe('the advice for rows a required column has no value for', () => {
  it('on db update and db init, says to set the values, keep the field optional, or plan a backfill', () => {
    const rowsWithoutValue = { field: 'Item.note', reason: 'nullValues' } as const;
    expect([
      mapDbUpdateFailure({ ...runnerFailed, conflicts: undefined, rowsWithoutValue }).fix,
      mapDbInitFailure({ ...runnerFailed, conflicts: undefined, rowsWithoutValue }).fix,
    ]).toEqual(
      Array(2).fill(
        'Set a value in those rows, or keep the field optional. Or plan it with `{bin} migration plan --backfill Item.note` and fill the backfill step.',
      ),
    );
  });

  it('on db update, points a new required column at a backfill, an optional field or a default', () => {
    expect(
      mapDbUpdateFailure({
        ...runnerFailed,
        conflicts: undefined,
        rowsWithoutValue: { field: 'My Model.code', reason: 'newField' },
      }).fix,
    ).toBe(
      "Plan it with `{bin} migration plan --backfill 'My Model.code'` and fill the backfill step, make the field optional, or give it a default.",
    );
  });

  it('suggests no backfill when the contract names no field', () => {
    expect([
      mapDbUpdateFailure({
        ...runnerFailed,
        conflicts: undefined,
        rowsWithoutValue: { field: undefined, reason: 'nullValues' },
      }).fix,
      mapDbUpdateFailure({
        ...runnerFailed,
        conflicts: undefined,
        rowsWithoutValue: { field: undefined, reason: 'newField' },
      }).fix,
    ]).toEqual([
      'Set a value in those rows, or keep the field optional.',
      'Make it optional, or give it a default.',
    ]);
  });

  it('on db migrate, says to set the values and re-run, or to plan the written migration again with a backfill', () => {
    expect([
      mapMigrateFailure({
        ...runnerFailed,
        rowsWithoutValue: { field: 'Item.note', reason: 'nullValues' },
        failedMigration,
      }).fix,
      mapMigrateFailure({
        ...runnerFailed,
        rowsWithoutValue: { field: 'User.code', reason: 'newField' },
        failedMigration,
      }).fix,
    ]).toEqual([
      `Set a value in those rows and re-run \`{bin} db migrate\`. Or delete the migration directory \`migrations/app/20261012T1200_note\`, plan it again with \`{bin} migration plan --from ${FROM} --backfill Item.note\` and fill the backfill step.`,
      `The failed apply changed nothing. To keep the field required, delete the migration directory \`migrations/app/20261012T1200_note\`, plan it again with \`{bin} migration plan --from ${FROM} --backfill User.code\` and fill the backfill step. Or make the field optional or give it a default, and plan it again.`,
    ]);
  });

  it('never mentions schema drift', () => {
    expect(
      mapDbUpdateFailure({
        ...runnerFailed,
        conflicts: undefined,
        rowsWithoutValue: { field: 'Item.note', reason: 'nullValues' },
      }).fix,
    ).not.toContain('drift');
  });
});
