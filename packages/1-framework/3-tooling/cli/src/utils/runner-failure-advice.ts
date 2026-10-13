import { basename } from 'pathe';
import { statementFlag } from '../control-api/statements/statement-flag';
import type {
  FailedTypeChangeCastReport,
  MigrateFailure,
  RowsWithoutValueReport,
} from '../control-api/types';
import { type CliInvocation, cliCommand, printedPath, selfEmitCommand } from './printed-command';

type FailedMigration = NonNullable<MigrateFailure['failedMigration']>;

/** What a runner failure says of a type change whose cast failed. */
export function failedCastText(cast: FailedTypeChangeCastReport): string {
  switch (cast.reason) {
    case 'noCast':
      return `The database has no cast from the old type of field "${cast.field}" to its new type.`;
    case 'conversion':
      return `The conversion of field "${cast.field}" left a value its new type cannot hold.`;
    case 'value':
      return `A value of field "${cast.field}" cannot be converted to its new type by the database's cast.`;
  }
}

/** A `migration plan` command as advice prints it, starting from `from` when it is known. */
export function migrationPlanCommand(
  invocation: CliInvocation,
  flags: readonly string[],
  from: string | undefined,
): string {
  return `\`${cliCommand(invocation, 'migration plan', [...(from === undefined ? [] : ['--from', from]), ...flags])}\``;
}

/** A `db migrate` command as advice prints it. */
function dbMigrateCommand(invocation: CliInvocation): string {
  return `\`${cliCommand(invocation, 'db migrate')}\``;
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
  cast: FailedTypeChangeCastReport,
  databaseStorageHash: string | undefined,
  invocation: CliInvocation,
): string {
  const plan = migrationPlanCommand(
    invocation,
    [statementFlag({ verb: 'convert', text: cast.field })],
    databaseStorageHash,
  );
  return `${failedCastText(cast)} Plan the change with ${plan}, write the conversion in the migration.ts it writes, and apply it with ${dbMigrateCommand(invocation)}.`;
}

/** The way out of rows without a value for `db update`, which plans and applies in one step. */
export function dbUpdateRowsWithoutValueFix(
  reports: readonly RowsWithoutValueReport[],
  databaseStorageHash: string | undefined,
  invocation: CliInvocation,
): string {
  const flags = backfillFlags(reports);
  const plan =
    flags.length === 0
      ? undefined
      : `${migrationPlanCommand(invocation, flags, databaseStorageHash)}, fill the backfill steps in the migration.ts it writes, and apply it with ${dbMigrateCommand(invocation)}`;
  if (reports[0]?.reason === 'nullValues') {
    const keep = 'Set a value in those rows, or keep the field optional.';
    return plan === undefined ? keep : `${keep} Or plan it with ${plan}.`;
  }
  return plan === undefined
    ? 'Make the field optional.'
    : `Plan it with ${plan}. Or make the field optional.`;
}

/**
 * The way out of rows without a value for `db init`: a migration plan needs an origin contract,
 * which a database that `db init` never initialized does not have.
 */
export function dbInitRowsWithoutValueFix(
  reports: readonly RowsWithoutValueReport[],
  invocation: CliInvocation,
): string {
  const field = reports[0]?.field;
  const subject = field === undefined ? 'it' : `field "${field}"`;
  return `Run \`${cliCommand(invocation, 'db init')}\` with ${subject} optional. Then make it required with \`${cliCommand(invocation, 'db update')}\`, which says how to give the rows a value.`;
}

/**
 * A failed migration as the advice names it: its directory relative to where the user ran the
 * CLI, its name, the `node` command that runs its `migration.ts`, and the CLI invocation the other
 * printed commands repeat.
 */
interface FailedMigrationText {
  readonly directory: string;
  readonly name: string;
  readonly from: string;
  readonly nodeCommand: string;
  readonly invocation: CliInvocation;
}

function failedMigrationText(
  failed: FailedMigration,
  invocation: CliInvocation,
): FailedMigrationText {
  const dirName = basename(failed.directory);
  const directory = printedPath(invocation, failed.directory);
  return {
    directory,
    name: dirName.slice(dirName.indexOf('_') + 1),
    from: failed.from,
    nodeCommand: selfEmitCommand(`${directory}/migration.ts`, invocation.configPath),
    invocation,
  };
}

function replan(
  flags: readonly string[],
  failed: FailedMigrationText,
  except: string | undefined = undefined,
): string {
  const others =
    except === undefined ? 'its other statements' : `its other statements except ${except}`;
  const plan = migrationPlanCommand(
    failed.invocation,
    ['--name', failed.name, ...flags],
    failed.from,
  );
  return `delete \`${failed.directory}\` (copy any code you wrote in its migration.ts first), plan it again with ${plan} and ${others}, fill in the migration.ts it writes, and run ${dbMigrateCommand(failed.invocation)}`;
}

/**
 * Where to fix code written in the failed migration's `migration.ts`, and the command that runs the
 * file again.
 */
function failedMigrationFile(failedMigration: FailedMigrationText | undefined): {
  readonly file: string;
  readonly run: string;
} {
  if (failedMigration === undefined) {
    return { file: 'the migration.ts of the failed migration', run: 'run that file with node' };
  }
  return {
    file: `\`${failedMigration.directory}/migration.ts\``,
    run: `run \`${failedMigration.nodeCommand}\``,
  };
}

function migrateFailedCastFix(
  cast: FailedTypeChangeCastReport,
  failedMigration: FailedMigrationText | undefined,
  invocation: CliInvocation,
): string {
  if (cast.reason === 'conversion') {
    const { file, run } = failedMigrationFile(failedMigration);
    return `${failedCastText(cast)} The failed apply changed nothing. Fix the conversion in ${file} so that it converts every value, ${run}, and re-run ${dbMigrateCommand(invocation)}.`;
  }
  const convert = statementFlag({ verb: 'convert', text: cast.field });
  if (failedMigration === undefined) {
    return `${failedCastText(cast)} Plan the type change again with ${migrationPlanCommand(invocation, [convert], undefined)}, and write the conversion in the migration.ts it writes.`;
  }
  const deleted = `\`${statementFlag({ verb: 'delete', text: cast.field })}\``;
  return `${failedCastText(cast)} The failed apply changed nothing. To convert it, ${replan([convert], failedMigration, deleted)}.`;
}

function migrateRowsWithoutValueFix(
  reports: readonly RowsWithoutValueReport[],
  failedMigration: FailedMigrationText | undefined,
  invocation: CliInvocation,
): string {
  const [first] = reports;
  if (first?.reason === 'backfillMissedRows') {
    const { file, run } = failedMigrationFile(failedMigration);
    const step =
      first.field === undefined
        ? 'The backfill step'
        : `The backfill step of field "${first.field}"`;
    return `${step} left those rows without a value, and the failed apply changed nothing. Make its run fill every row in ${file}, ${run}, and re-run ${dbMigrateCommand(invocation)}.`;
  }
  const flags = backfillFlags(reports);
  const again =
    flags.length === 0 || failedMigration === undefined
      ? undefined
      : replan(flags, failedMigration);
  if (reports.every(({ reason }) => reason === 'nullValues')) {
    const rerun =
      reports.length === 1
        ? `Set a value in those rows and re-run ${dbMigrateCommand(invocation)}.`
        : `Set a value in the rows that hold NULL in each of ${fieldList(reports)} and re-run ${dbMigrateCommand(invocation)}.`;
    const keep =
      failedMigration === undefined
        ? `Or keep ${reports.length === 1 ? 'the field' : 'those fields'} optional, and plan the migration again.`
        : `Or keep ${reports.length === 1 ? 'the field' : 'those fields'} optional: make ${reports.length === 1 ? 'it' : 'them'} optional in the contract again, delete \`${failedMigration.directory}\` (copy any code you wrote in its migration.ts first), and plan it again with ${migrationPlanCommand(invocation, ['--name', failedMigration.name], failedMigration.from)} and its other statements.`;
    return [rerun, ...(again === undefined ? [] : [`Or ${again}.`]), keep].join(' ');
  }
  if (reports[0]?.reason === 'nullValues') {
    return again === undefined
      ? 'The migration also adds a required field the existing rows have no value for, so setting values is not enough: make the new fields optional, and plan the migration again.'
      : `The migration also adds a required field the existing rows have no value for, so setting values is not enough. The failed apply changed nothing: ${again}.`;
  }
  return again === undefined
    ? 'Make the field optional, and plan the migration again.'
    : `The failed apply changed nothing. To keep the field required, ${again}. Or make the field optional, and plan it again.`;
}

function fieldList(reports: readonly RowsWithoutValueReport[]): string {
  return reports
    .map(({ field }) => (field === undefined ? undefined : `"${field}"`))
    .filter((field) => field !== undefined)
    .join(', ');
}

/**
 * The way out of a failed `db migrate` apply: every path and command it prints works from where the
 * CLI ran, with the `--config` it was given.
 */
export function migrateFix(failure: MigrateFailure, invocation: CliInvocation): string {
  const failedMigration =
    failure.failedMigration === undefined
      ? undefined
      : failedMigrationText(failure.failedMigration, invocation);
  if (failure.failedCast !== undefined) {
    return migrateFailedCastFix(failure.failedCast, failedMigration, invocation);
  }
  if (failure.rowsWithoutValue !== undefined) {
    return migrateRowsWithoutValueFix(failure.rowsWithoutValue, failedMigration, invocation);
  }
  return `Fix the issue and re-run \`${cliCommand(invocation, 'db migrate', ['--to', '<contract>'])}\` — previously applied migrations are preserved.`;
}
