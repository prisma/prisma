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

/** A `migration plan` command, starting from `from` when it is known. */
export function migrationPlanCommand(flags: readonly string[], from: string | undefined): string {
  return `\`{bin} migration plan ${[...(from === undefined ? [] : ['--from', from]), ...flags].join(' ')}\``;
}

function backfillFlags(reports: readonly RowsWithoutValueReport[]): readonly string[] {
  return [
    ...new Set(
      reports.flatMap(({ field }) =>
        field === undefined ? [] : [statementFlag({ verb: 'backfill', text: field })],
      ),
    ),
  ];
}

/** The way out of a failed cast for `db update`, which plans and applies in one step. */
export function dbUpdateFailedCastFix(
  cast: FailedCastReport,
  databaseContract: string | undefined,
): string {
  const plan = migrationPlanCommand(
    [statementFlag({ verb: 'convert', text: cast.field })],
    databaseContract,
  );
  return `${failedCastText(cast)} Plan the change with ${plan}, write the conversion in the migration.ts it writes, and apply it with \`{bin} db migrate\`.`;
}

/** The way out of rows without a value for `db update`, which plans and applies in one step. */
export function dbUpdateRowsWithoutValueFix(
  reports: readonly RowsWithoutValueReport[],
  databaseContract: string | undefined,
): string {
  const flags = backfillFlags(reports);
  const plan =
    flags.length === 0
      ? undefined
      : `${migrationPlanCommand(flags, databaseContract)}, fill the backfill steps in the migration.ts it writes, and apply it with \`{bin} db migrate\``;
  if (reports[0]?.reason === 'nullValues') {
    const keep = 'Set a value in those rows, or keep the field optional.';
    return plan === undefined ? keep : `${keep} Or plan it with ${plan}.`;
  }
  return plan === undefined
    ? 'Make it optional, or give it a default.'
    : `Plan it with ${plan}. Or make the field optional, or give it a default.`;
}

/**
 * The way out of rows without a value for `db init`: a migration plan needs an origin contract,
 * which a database that `db init` never initialised does not have.
 */
export function dbInitRowsWithoutValueFix(reports: readonly RowsWithoutValueReport[]): string {
  const field = reports[0]?.field;
  const subject = field === undefined ? 'it' : `field "${field}"`;
  return `Run \`{bin} db init\` with ${subject} optional, or give it a default. Then make it required with \`{bin} db update\`, which says how to give the rows a value.`;
}

function replan(
  flags: readonly string[],
  failedMigration: FailedMigration,
  except: string | undefined = undefined,
): string {
  const { directory, from } = failedMigration;
  const earlier =
    except === undefined
      ? 'the statements you planned it with before'
      : `the statements you planned it with before, except ${except}`;
  return `copy any code you wrote in \`${directory}/migration.ts\`, delete \`${directory}\`, and plan it again with ${migrationPlanCommand(flags, from)} and ${earlier}. Then write that code and the new steps in the migration.ts it writes, and apply it with \`{bin} db migrate\``;
}

function migrateFailedCastFix(
  cast: FailedCastReport,
  failedMigration: FailedMigration | undefined,
): string {
  const convert = statementFlag({ verb: 'convert', text: cast.field });
  if (failedMigration === undefined) {
    return `${failedCastText(cast)} Plan the type change again with \`{bin} migration plan ${convert}\`, and write the conversion in the migration.ts it writes.`;
  }
  const deleted = `\`${statementFlag({ verb: 'delete', text: cast.field })}\``;
  return `${failedCastText(cast)} The failed apply changed nothing. To convert it, ${replan([convert], failedMigration, deleted)}.`;
}

function migrateRowsWithoutValueFix(
  reports: readonly RowsWithoutValueReport[],
  failedMigration: FailedMigration | undefined,
): string {
  const flags = backfillFlags(reports);
  const again =
    flags.length === 0 || failedMigration === undefined
      ? undefined
      : replan(flags, failedMigration);
  if (reports.every(({ reason }) => reason === 'nullValues')) {
    const rerun =
      reports.length === 1
        ? 'Set a value in those rows and re-run `{bin} db migrate`.'
        : `Set a value in the rows that hold NULL in each of ${fieldList(reports)} and re-run \`{bin} db migrate\`.`;
    return again === undefined ? rerun : `${rerun} Or ${again}.`;
  }
  if (reports[0]?.reason === 'nullValues') {
    return again === undefined
      ? 'The migration also adds a required field the existing rows have no value for, so setting values is not enough: make the new fields optional or give them a default, and plan the migration again.'
      : `The migration also adds a required field the existing rows have no value for, so setting values is not enough. The failed apply changed nothing: ${again}.`;
  }
  return again === undefined
    ? 'Make the field optional or give it a default, and plan the migration again.'
    : `The failed apply changed nothing. To keep the field required, ${again}. Or make the field optional or give it a default, and plan it again.`;
}

function fieldList(reports: readonly RowsWithoutValueReport[]): string {
  return reports
    .map(({ field }) => (field === undefined ? undefined : `"${field}"`))
    .filter((field) => field !== undefined)
    .join(', ');
}

function migrateFix(failure: MigrateFailure): string {
  if (failure.failedCast !== undefined) {
    return migrateFailedCastFix(failure.failedCast, failure.failedMigration);
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
