import { ifDefined } from '@internal/utils/defined';
import { statementFlag } from '../control-api/statements/statement-flag';
import type {
  FailedCastReport,
  MigrateFailure,
  RowsWithoutValueReport,
} from '../control-api/types';
import type { CliStructuredError } from './cli-errors';
import { errorPathUnreachable, errorRunnerFailed } from './cli-errors';

type FailedMigration = NonNullable<MigrateFailure['failedMigration']>;

/** What a runner failure says of a type change whose cast failed. */
export function failedCastText(cast: FailedCastReport): string {
  return cast.reason === 'noCast'
    ? `The database has no cast from the old type of field "${cast.field}" to its new type.`
    : `A value of field "${cast.field}" cannot be converted to its new type by the database's cast.`;
}

function backfillPlan(field: string, failedMigration?: FailedMigration): string {
  const from = failedMigration === undefined ? '' : `--from ${failedMigration.from} `;
  return `\`{bin} migration plan ${from}${statementFlag({ verb: 'backfill', text: field })}\``;
}

/** The way out of rows without a value, for a command that plans and applies in one step. */
export function rowsWithoutValueFix(report: RowsWithoutValueReport): string {
  if (report.reason === 'nullValues') {
    const backfill =
      report.field === undefined
        ? ''
        : ` Or plan it with ${backfillPlan(report.field)} and fill the backfill step.`;
    return `Set a value in those rows, or keep the field optional.${backfill}`;
  }
  return report.field === undefined
    ? 'Make it optional, or give it a default.'
    : `Plan it with ${backfillPlan(report.field)} and fill the backfill step, make the field optional, or give it a default.`;
}

function migrateRowsWithoutValueFix(
  report: RowsWithoutValueReport,
  failedMigration: FailedMigration | undefined,
): string {
  const replan =
    report.field === undefined || failedMigration === undefined
      ? undefined
      : `delete the migration directory \`${failedMigration.directory}\`, plan it again with ${backfillPlan(report.field, failedMigration)} and fill the backfill step`;
  if (report.reason === 'nullValues') {
    const rerun = 'Set a value in those rows and re-run `{bin} db migrate`.';
    return replan === undefined ? rerun : `${rerun} Or ${replan}.`;
  }
  return replan === undefined
    ? 'Make the field optional or give it a default, and plan the migration again.'
    : `The failed apply changed nothing. To keep the field required, ${replan}. Or make the field optional or give it a default, and plan it again.`;
}

function failedCastFix(
  cast: FailedCastReport,
  failedMigration: FailedMigration | undefined,
): string {
  const convert = statementFlag({ verb: 'convert', text: cast.field });
  if (failedMigration === undefined) {
    return `${failedCastText(cast)} Plan the type change again with \`{bin} migration plan ${convert}\`, and write the conversion in the migration.ts it writes.`;
  }
  const { directory, from } = failedMigration;
  return `${failedCastText(cast)} The failed apply changed nothing. Delete the migration directory \`${directory}\`, plan the type change again with \`{bin} migration plan --from ${from} ${convert}\`, write the conversion in the migration.ts it writes, and apply it with \`{bin} db migrate\`.`;
}

function migrateFix(failure: MigrateFailure): string {
  if (failure.failedCast !== undefined) {
    return failedCastFix(failure.failedCast, failure.failedMigration);
  }
  if (failure.rowsWithoutValue !== undefined) {
    return migrateRowsWithoutValueFix(failure.rowsWithoutValue, failure.failedMigration);
  }
  return 'Fix the issue and re-run `{bin} db migrate --to <contract>` — previously applied migrations are preserved.';
}

/** A `migrate` apply failure as the CLI's structured error. */
export function mapMigrateFailure(failure: MigrateFailure): CliStructuredError {
  if (failure.code === 'MIGRATION_PATH_NOT_FOUND') {
    return errorPathUnreachable(failure);
  }
  return errorRunnerFailed(failure.summary, {
    why: failure.why ?? 'Migration runner failed',
    fix: migrateFix(failure),
    meta: failure.meta ?? {},
    ...ifDefined('cause', failure.cause),
  });
}
