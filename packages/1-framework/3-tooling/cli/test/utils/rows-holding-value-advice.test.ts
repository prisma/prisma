import { migrationRunnerFailure } from '@internal/framework-components/control';
import { describe, expect, it } from 'vitest';
import { dbUpdateRunnerFailureError } from '../../src/utils/db-update-failure';
import { migrateRunnerFailureError } from '../../src/utils/migrate-failure';

const PROJECT = { cwd: '/work/app', configPath: undefined, dbGiven: false };
const FROM = 'sha256:0123';

const failure = migrationRunnerFailure(
  'MIGRATION.PRECHECK_FAILED',
  '2 rows of "task" hold "archived" in column "status", which takes no NULL, so enum value "Status.ARCHIVED" cannot be removed.',
  {
    why: 'Operation removeStoredValue.task.status.archived failed during precheck: ensure column "status" of "task" takes NULL, or no row holds "archived" in it',
    meta: {
      failedCheck: {
        operationId: 'removeStoredValue.task.status.archived',
        phase: 'precheck',
        description:
          'ensure column "status" of "task" takes NULL, or no row holds "archived" in it',
      },
      databaseUnchanged: true,
    },
  },
);

const rowsHoldingValue = { enumValue: 'Status.ARCHIVED', value: 'archived', rows: 2 } as const;

function labels(error: { readonly nextActions?: readonly { readonly label: string }[] }) {
  return (error.nextActions ?? []).map(({ label }) => label);
}

describe('the advice when a removed enum value is still held by rows of a required column', () => {
  it('on db update, says to rename the value, or to keep the rows by hand through migration plan', () => {
    const error = dbUpdateRunnerFailureError(
      failure,
      {
        rowsHoldingValue,
        failedPrecheck: {
          operationId: 'removeStoredValue.task.status.archived',
          description:
            'ensure column "status" of "task" takes NULL, or no row holds "archived" in it',
          planStartsFromMarker: false,
        },
      },
      { databaseStorageHash: FROM, invocation: PROJECT },
    );

    expect(labels(error)).toEqual([
      'To keep those rows under a new enum value, add a member to enum "Status" in the contract source, run `{bin} contract emit`, then run `{bin} db update --rename \'Status.ARCHIVED:Status.<new member>\'`',
      'To keep those rows by hand, plan the change with `{bin} migration plan --from sha256:0123 --delete Status.ARCHIVED`, replace this.removeStoredValue({ ..., value: "archived", ..., enumValue: "Status.ARCHIVED" }) with this.replaceStoredValue({ ..., from: "archived", to: "<stored value>", ... }) in the migration.ts it writes, where "<stored value>" is a stored value the enum keeps, run that migration.ts with the `node` command `migration plan` prints, and apply it with `{bin} db migrate`. db update cannot keep the data by hand',
    ]);
  });

  it('on db update with no migration at the database contract, says to change the rows in the database instead', () => {
    const error = dbUpdateRunnerFailureError(
      failure,
      { rowsHoldingValue },
      { databaseStorageHash: undefined, invocation: PROJECT },
    );

    expect(labels(error)[1]).toBe(
      'To keep those rows with another stored value, set the rows that hold "archived" to a stored value the enum keeps in the database yourself, then re-run `{bin} db update --delete Status.ARCHIVED`. db update cannot keep the data by hand in a migration.ts',
    );
  });

  it('on db migrate, says to plan the migration again with a rename, or to change the migration.ts', () => {
    const error = migrateRunnerFailureError(
      failure,
      {
        rowsHoldingValue,
        failedPrecheck: {
          operationId: 'removeStoredValue.task.status.archived',
          description:
            'ensure column "status" of "task" takes NULL, or no row holds "archived" in it',
          planStartsFromMarker: true,
        },
      },
      { directory: '/work/app/migrations/app/20260101T0000_retire', from: FROM },
      PROJECT,
    );

    expect(labels(error)).toEqual([
      'To keep those rows under a new enum value, add a member to enum "Status" in the contract source, run `{bin} contract emit`, delete `migrations/app/20260101T0000_retire` (copy any code you wrote in its migration.ts first), plan it again with `{bin} migration plan --from sha256:0123 --name retire --rename \'Status.ARCHIVED:Status.<new member>\'`, adding any other statements you planned it with except any `--delete Status.ARCHIVED`, fill in the migration.ts it writes, run that migration.ts with the `node` command `migration plan` prints, and run `{bin} db migrate`',
      'To keep those rows by hand, replace this.removeStoredValue({ ..., value: "archived", ..., enumValue: "Status.ARCHIVED" }) with this.replaceStoredValue({ ..., from: "archived", to: "<stored value>", ... }) in `migrations/app/20260101T0000_retire/migration.ts`, where "<stored value>" is a stored value the enum keeps, run `node migrations/app/20260101T0000_retire/migration.ts`, and re-run `{bin} db migrate`',
    ]);
    expect(JSON.stringify(error.nextActions)).not.toContain('drifted');
  });
});
