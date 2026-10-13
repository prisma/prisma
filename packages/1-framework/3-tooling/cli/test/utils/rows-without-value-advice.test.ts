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
const PROJECT = '/work/app';
const failedMigration = { directory: `${PROJECT}/migrations/app/20261012T1200_note`, from: FROM };

describe('the advice for rows a required field has no value for', () => {
  it('on db update, says to set the values, keep the field optional, or plan a backfill from the database contract', () => {
    expect(
      mapDbUpdateFailure({
        ...runnerFailed,
        conflicts: undefined,
        rowsWithoutValue: [{ field: 'Item.note', reason: 'nullValues' }],
        databaseStorageHash: DATABASE,
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
        databaseStorageHash: DATABASE,
      }).fix,
    ).toBe(
      `Plan it with \`{bin} migration plan --from ${DATABASE} --backfill 'My Model.code' --backfill 'My Model.role'\`, fill the backfill steps in the migration.ts it writes, and apply it with \`{bin} db migrate\`. Or make the field optional.`,
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
      'Make the field optional.',
    ]);
  });

  it('on db init, says to initialize with the field optional and make it required with db update', () => {
    expect(
      mapDbInitFailure({
        ...runnerFailed,
        conflicts: undefined,
        rowsWithoutValue: [{ field: 'Item.code', reason: 'newField' }],
      }).fix,
    ).toBe(
      'Run `{bin} db init` with field "Item.code" optional. Then make it required with `{bin} db update`, which says how to give the rows a value.',
    );
  });

  it('on db migrate, keeps the statements of the failed migration and adds a backfill for every field that needs one', () => {
    const rowsWithoutValue = [
      { field: 'Item.role', reason: 'newField' },
      { field: 'Item.code', reason: 'newField' },
    ] as const;
    const replan = `delete \`migrations/app/20261012T1200_note\` (copy any code you wrote in its migration.ts first), plan it again with \`{bin} migration plan --from ${FROM} --name note --backfill Item.role --backfill Item.code\` and its other statements, fill in the migration.ts it writes, and run \`{bin} db migrate\``;
    expect([
      mapMigrateFailure({ ...runnerFailed, rowsWithoutValue, failedMigration }, PROJECT).fix,
      mapMigrateFailure(
        {
          ...runnerFailed,
          rowsWithoutValue: [{ field: 'Item.role', reason: 'nullValues' }, rowsWithoutValue[1]],
          failedMigration,
        },
        PROJECT,
      ).fix,
    ]).toEqual([
      `The failed apply changed nothing. To keep the field required, ${replan}. Or make the field optional, and plan it again.`,
      `The migration also adds a required field the existing rows have no value for, so setting values is not enough. The failed apply changed nothing: ${replan}.`,
    ]);
    expect(
      mapMigrateFailure(
        {
          ...runnerFailed,
          rowsWithoutValue: [
            { field: 'Item.note', reason: 'nullValues' },
            { field: 'Item.nick', reason: 'nullValues' },
          ],
        },
        PROJECT,
      ).fix,
    ).toBe(
      'Set a value in the rows that hold NULL in each of "Item.note", "Item.nick" and re-run `{bin} db migrate`. Or keep those fields optional, and plan the migration again.',
    );
  });

  it('on db migrate, offers keeping a field with NULL rows optional, as db update does', () => {
    expect(
      mapMigrateFailure(
        {
          ...runnerFailed,
          rowsWithoutValue: [{ field: 'Item.note', reason: 'nullValues' }],
          failedMigration,
        },
        PROJECT,
      ).fix,
    ).toBe(
      `Set a value in those rows and re-run \`{bin} db migrate\`. Or delete \`migrations/app/20261012T1200_note\` (copy any code you wrote in its migration.ts first), plan it again with \`{bin} migration plan --from ${FROM} --name note --backfill Item.note\` and its other statements, fill in the migration.ts it writes, and run \`{bin} db migrate\`. Or keep the field optional: make it optional in the contract again, delete \`migrations/app/20261012T1200_note\` (copy any code you wrote in its migration.ts first), and plan it again with \`{bin} migration plan --from ${FROM} --name note\` and its other statements.`,
    );
  });

  it('on db migrate, says the backfill step left the rows without a value and to fix the step, not to plan again', () => {
    const advice = (failed: typeof failedMigration | undefined) =>
      mapMigrateFailure(
        {
          ...runnerFailed,
          rowsWithoutValue: [{ field: 'Item.note', reason: 'backfillMissedRows' }],
          ...(failed === undefined ? {} : { failedMigration: failed }),
        },
        PROJECT,
      ).fix;
    expect([advice(failedMigration), advice(undefined)]).toEqual([
      'The backfill step of field "Item.note" left those rows without a value, and the failed apply changed nothing. Make its run fill every row in `migrations/app/20261012T1200_note/migration.ts`, run that file with node, and re-run `{bin} db migrate`.',
      'The backfill step of field "Item.note" left those rows without a value, and the failed apply changed nothing. Make its run fill every row in the migration.ts of the failed migration, run that file with node, and re-run `{bin} db migrate`.',
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
