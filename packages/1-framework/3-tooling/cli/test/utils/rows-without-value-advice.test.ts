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

const DATABASE = 'a'.repeat(64);
const FROM = 'b'.repeat(64);
const failedMigration = { directory: 'migrations/app/20261012T1200_note', from: FROM };

describe('the advice for rows a required field has no value for', () => {
  it('on db update, says to set the values, keep the field optional, or plan a backfill from the database contract', () => {
    expect(
      mapDbUpdateFailure({
        ...runnerFailed,
        conflicts: undefined,
        rowsWithoutValue: [{ field: 'Item.note', reason: 'nullValues' }],
        databaseContract: DATABASE,
      }).fix,
    ).toBe(
      `Set a value in those rows, or keep the field optional. Or plan it with \`{bin} migration plan --from ${DATABASE} --backfill Item.note\`, fill the backfill steps in the migration.ts it writes, and apply it with \`{bin} db migrate\`.`,
    );
  });

  it('on db update, names a backfill for every field of the plan that needs one, each once', () => {
    expect(
      mapDbUpdateFailure({
        ...runnerFailed,
        conflicts: undefined,
        rowsWithoutValue: [
          { field: 'My Model.code', reason: 'newField' },
          { field: 'My Model.role', reason: 'newField' },
          { field: 'My Model.code', reason: 'newField' },
          { field: undefined, reason: 'nullValues' },
        ],
        databaseContract: DATABASE,
      }).fix,
    ).toBe(
      `Plan it with \`{bin} migration plan --from ${DATABASE} --backfill 'My Model.code' --backfill 'My Model.role'\`, fill the backfill steps in the migration.ts it writes, and apply it with \`{bin} db migrate\`. Or make the field optional, or give it a default.`,
    );
  });

  it('suggests no backfill when the contract names no field', () => {
    expect([
      mapDbUpdateFailure({
        ...runnerFailed,
        conflicts: undefined,
        rowsWithoutValue: [{ field: undefined, reason: 'nullValues' }],
      }).fix,
      mapDbUpdateFailure({
        ...runnerFailed,
        conflicts: undefined,
        rowsWithoutValue: [{ field: undefined, reason: 'newField' }],
      }).fix,
    ]).toEqual([
      'Set a value in those rows, or keep the field optional.',
      'Make it optional, or give it a default.',
    ]);
  });

  it('on db init, says to initialise with the field optional and make it required with db update', () => {
    expect(
      mapDbInitFailure({
        ...runnerFailed,
        conflicts: undefined,
        rowsWithoutValue: [{ field: 'Item.code', reason: 'newField' }],
      }).fix,
    ).toBe(
      'Run `{bin} db init` with field "Item.code" optional, or give it a default. Then make it required with `{bin} db update`, which says how to give the rows a value.',
    );
  });

  it('on db migrate, keeps the statements of the failed migration and adds a backfill for every field that needs one', () => {
    const rowsWithoutValue = [
      { field: 'Item.role', reason: 'newField' },
      { field: 'Item.code', reason: 'newField' },
    ] as const;
    const replan = `copy any code you wrote in \`migrations/app/20261012T1200_note/migration.ts\`, delete \`migrations/app/20261012T1200_note\`, and plan it again with \`{bin} migration plan --from ${FROM} --backfill Item.role --backfill Item.code\` and the statements you planned it with before. Then write that code and the new steps in the migration.ts it writes, and apply it with \`{bin} db migrate\``;
    expect([
      mapMigrateFailure({ ...runnerFailed, rowsWithoutValue, failedMigration }).fix,
      mapMigrateFailure({
        ...runnerFailed,
        rowsWithoutValue: [{ field: 'Item.role', reason: 'nullValues' }, rowsWithoutValue[1]],
        failedMigration,
      }).fix,
    ]).toEqual([
      `The failed apply changed nothing. To keep the field required, ${replan}. Or make the field optional or give it a default, and plan it again.`,
      `Set a value in those rows and re-run \`{bin} db migrate\`. Or ${replan}.`,
    ]);
  });

  it('never mentions schema drift', () => {
    expect(
      mapDbUpdateFailure({
        ...runnerFailed,
        conflicts: undefined,
        rowsWithoutValue: [{ field: 'Item.note', reason: 'nullValues' }],
      }).fix,
    ).not.toContain('drift');
  });
});
