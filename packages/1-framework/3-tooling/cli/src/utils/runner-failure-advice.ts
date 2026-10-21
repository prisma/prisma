import type { MigrationRunnerFailure } from '@internal/framework-components/control';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import type { NextAction } from '@prisma/cli-engine/protocol';
import { basename, join } from 'pathe';
import { statementFlag } from '../control-api/statements/statement-flag';
import type {
  FailedTypeChangeReport,
  RowsWithoutValueReport,
  RunnerFailureFacts,
} from '../control-api/types';
import { migrateFailedPrecheckAdvice } from './failed-precheck-advice';
import { chooseAction, editFileAction } from './next-actions';
import {
  type CliInvocation,
  cliCommand,
  printedPath,
  printedPlanCommand,
  selfEmitCommand,
} from './printed-command';
import type { RunnerAdvice } from './runner-advice';
import { schemaCheckIssues } from './schema-check-issues';

/** The written migration of the failed operation: its directory, and the contract it starts from. */
export interface FailedMigrationOnDisk {
  readonly directory: string;
  readonly from: string;
}

/** What a runner failure says of a type change that failed: who converted the values, and how it failed. */
export function failedTypeChangeText(change: FailedTypeChangeReport): string {
  if (change.by === 'cast') {
    return change.reason === 'noCast'
      ? `The database has no cast from the old type of field "${change.field}" to its new type.`
      : `A value of field "${change.field}" cannot be converted to its new type by the database's cast.`;
  }
  switch (change.reason) {
    case 'value':
      return `The conversion of field "${change.field}" failed on a value its new type cannot hold.`;
    case 'invalidResult':
      return `The conversion of field "${change.field}" left a value its new type cannot hold.`;
    case 'expressionError':
      return `The conversion of field "${change.field}" failed with an error in its expression.`;
  }
}

function quoted(command: string): string {
  return `\`${command}\``;
}

/** A `db migrate` command as advice prints it. */
function dbMigrateCommand(invocation: CliInvocation): string {
  return quoted(cliCommand(invocation, 'db migrate'));
}

/** The step between filling a planned migration.ts and applying it, which writes its operations. */
const RUN_PLANNED_FILE = 'run that migration.ts with the `node` command `migration plan` prints';

/** What advice that plans a migration again says of the statements it was planned with, which the CLI does not store. */
const OTHER_STATEMENTS = 'adding any other statements you planned it with';

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
export function dbUpdateFailedTypeChangeAdvice(
  change: FailedTypeChangeReport,
  databaseStorageHash: string | undefined,
  invocation: CliInvocation,
): RunnerAdvice {
  const plan = printedPlanCommand(invocation, databaseStorageHash, [
    statementFlag({ verb: 'convert', text: change.field }),
  ]);
  return [
    chooseAction(
      `${failedTypeChangeText(change)} Plan the change with ${quoted(plan)}, write the conversion in the migration.ts it writes, ${RUN_PLANNED_FILE}, and apply it with ${dbMigrateCommand(invocation)}`,
    ),
  ];
}

/** The way out of rows without a value for `db update`, which plans and applies in one step. */
export function dbUpdateRowsWithoutValueAdvice(
  reports: readonly RowsWithoutValueReport[],
  databaseStorageHash: string | undefined,
  invocation: CliInvocation,
): RunnerAdvice {
  const flags = backfillFlags(reports);
  const planned =
    flags.length === 0
      ? []
      : [
          chooseAction(
            `Plan it with ${quoted(printedPlanCommand(invocation, databaseStorageHash, flags))}, fill the backfill steps in the migration.ts it writes, ${RUN_PLANNED_FILE}, and apply it with ${dbMigrateCommand(invocation)}`,
          ),
        ];
  if (reports[0]?.reason === 'nullValues') {
    return [
      chooseAction('Set a value in those rows'),
      editFileAction('Keep the field optional'),
      ...planned,
    ];
  }
  return [...planned, editFileAction('Make the field optional')];
}

/**
 * The way out of rows without a value for `db init`: a migration plan needs an origin contract,
 * which a database that `db init` never initialized does not have.
 */
export function dbInitRowsWithoutValueAdvice(
  reports: readonly RowsWithoutValueReport[],
  invocation: CliInvocation,
): RunnerAdvice {
  const field = reports[0]?.field;
  const subject = field === undefined ? 'it' : `field "${field}"`;
  return [
    editFileAction(
      `Run ${quoted(cliCommand(invocation, 'db init'))} with ${subject} optional, then make it required with ${quoted(cliCommand(invocation, 'db update'))}, which says how to give the rows a value`,
    ),
  ];
}

/**
 * A failed migration as the advice names it: its directory relative to where the user ran the
 * CLI, its name, the `node` command that runs its `migration.ts`, and the CLI invocation the other
 * printed commands repeat.
 */
interface FailedMigrationText {
  readonly directory: string;
  readonly name: string;
  /** The contract the migration starts from, or `undefined` for the empty contract, which `migration plan` takes as its default origin and does not accept as `--from`. */
  readonly from: string | undefined;
  readonly nodeCommand: string;
  readonly invocation: CliInvocation;
}

function failedMigrationText(
  failed: FailedMigrationOnDisk,
  invocation: CliInvocation,
): FailedMigrationText {
  const dirName = basename(failed.directory);
  const directory = printedPath(invocation, failed.directory);
  return {
    directory,
    name: dirName.slice(dirName.indexOf('_') + 1),
    from: failed.from === EMPTY_CONTRACT_HASH ? undefined : failed.from,
    nodeCommand: selfEmitCommand(invocation, join(failed.directory, 'migration.ts')),
    invocation,
  };
}

/**
 * Planning the failed migration again with `flags`. `opening` is the words before the directory,
 * so the sentence can start the advice or follow why it is needed.
 */
function replan(
  opening: string,
  flags: readonly string[],
  failed: FailedMigrationText,
  except: string | undefined = undefined,
): NextAction {
  const others =
    except === undefined ? OTHER_STATEMENTS : `${OTHER_STATEMENTS} except any ${except}`;
  const plan = printedPlanCommand(failed.invocation, failed.from, [
    '--name',
    failed.name,
    ...flags,
  ]);
  return chooseAction(
    `${opening} \`${failed.directory}\` (copy any code you wrote in its migration.ts first), plan it again with ${quoted(plan)}, ${others}, fill in the migration.ts it writes, ${RUN_PLANNED_FILE}, and run ${dbMigrateCommand(failed.invocation)}`,
  );
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

function migrateFailedTypeChangeAdvice(
  change: FailedTypeChangeReport,
  failedMigration: FailedMigrationText | undefined,
  invocation: CliInvocation,
): RunnerAdvice {
  const changeText = failedTypeChangeText(change);
  const { file, run } = failedMigrationFile(failedMigration);
  if (change.by === 'conversion') {
    return [
      editFileAction(
        `${changeText} Fix the conversion in ${file}, ${run}, and re-run ${dbMigrateCommand(invocation)}`,
      ),
    ];
  }
  const convert = statementFlag({ verb: 'convert', text: change.field });
  if (failedMigration === undefined) {
    return [
      chooseAction(
        `${changeText} Plan the type change again with ${quoted(printedPlanCommand(invocation, undefined, [convert]))}, write the conversion in the migration.ts it writes, ${RUN_PLANNED_FILE}, and apply it with ${dbMigrateCommand(invocation)}`,
      ),
    ];
  }
  const deleted = `\`${statementFlag({ verb: 'delete', text: change.field })}\``;
  return [
    editFileAction(
      `${changeText} ${file} has no conversion for field "${change.field}": write one there, ${run}, and re-run ${dbMigrateCommand(invocation)}`,
    ),
    replan('Delete', [convert], failedMigration, deleted),
  ];
}

function migrateRowsWithoutValueAdvice(
  reports: readonly RowsWithoutValueReport[],
  failedMigration: FailedMigrationText | undefined,
  invocation: CliInvocation,
): RunnerAdvice {
  const [first] = reports;
  if (first?.reason === 'backfillMissedRows') {
    const { file, run } = failedMigrationFile(failedMigration);
    const step =
      first.field === undefined
        ? 'The backfill step'
        : `The backfill step of field "${first.field}"`;
    return [
      editFileAction(
        `${step} left those rows without a value. Make its run fill every row in ${file}, ${run}, and re-run ${dbMigrateCommand(invocation)}`,
      ),
    ];
  }
  const flags = backfillFlags(reports);
  const again = (opening: string) =>
    flags.length === 0 || failedMigration === undefined
      ? undefined
      : replan(opening, flags, failedMigration);
  const one = reports.length === 1;
  if (reports.every(({ reason }) => reason === 'nullValues')) {
    const rerun = chooseAction(
      one
        ? `Set a value in those rows and re-run ${dbMigrateCommand(invocation)}`
        : `Set a value in the rows that hold NULL in each of ${fieldList(reports)} and re-run ${dbMigrateCommand(invocation)}`,
    );
    const backfill = again('Delete');
    const fields = one ? 'the field' : 'those fields';
    const keep =
      failedMigration === undefined
        ? editFileAction(`Keep ${fields} optional, and plan the migration again`)
        : keepOptional(fields, one ? 'it' : 'them', failedMigration, invocation);
    return [rerun, ...(backfill === undefined ? [] : [backfill]), keep];
  }
  if (first?.reason === 'nullValues') {
    const notEnough =
      'The migration also adds a required field the existing rows have no value for, so setting values is not enough.';
    const backfill = again(`${notEnough} Delete`);
    return [
      backfill ??
        editFileAction(`${notEnough} Make the new fields optional, and plan the migration again`),
    ];
  }
  const required = again('To keep the field required, delete');
  return required === undefined
    ? [editFileAction('Make the field optional, and plan the migration again')]
    : [required, editFileAction('Make the field optional, and plan it again')];
}

function keepOptional(
  fields: string,
  pronoun: string,
  failedMigration: FailedMigrationText,
  invocation: CliInvocation,
): NextAction {
  const plan = printedPlanCommand(invocation, failedMigration.from, [
    '--name',
    failedMigration.name,
  ]);
  return editFileAction(
    `Keep ${fields} optional: make ${pronoun} optional in the contract again, delete \`${failedMigration.directory}\` (copy any code you wrote in its migration.ts first), and plan it again with ${quoted(plan)}, ${OTHER_STATEMENTS}, put back any code you copied, ${RUN_PLANNED_FILE}, and apply it with ${dbMigrateCommand(invocation)}`,
  );
}

function fieldList(reports: readonly RowsWithoutValueReport[]): string {
  return reports
    .map(({ field }) => (field === undefined ? undefined : `"${field}"`))
    .filter((field) => field !== undefined)
    .join(', ');
}

function migrateSchemaCheckAdvice(
  failedMigration: FailedMigrationText | undefined,
  invocation: CliInvocation,
): RunnerAdvice {
  const emit = quoted(cliCommand(invocation, 'contract emit'));
  const plan = printedPlanCommand(
    invocation,
    failedMigration?.from,
    failedMigration === undefined ? [] : ['--name', failedMigration.name],
  );
  const directory =
    failedMigration === undefined
      ? "the failed migration's directory"
      : `\`${failedMigration.directory}\``;
  const { file, run } = failedMigrationFile(failedMigration);
  return [
    editFileAction(
      `If the contract source does not describe the schema you want, change it to resolve the issues listed, re-run ${emit}, delete ${directory} (copy any code you wrote in its migration.ts first), plan it again with ${quoted(plan)}, put any code you copied into the migration.ts it writes, ${RUN_PLANNED_FILE}, and run ${dbMigrateCommand(invocation)}`,
    ),
    editFileAction(
      `If ${file} does not reach its destination contract, for example after a hand edit, change its operations to resolve the issues listed, ${run}, and run ${dbMigrateCommand(invocation)}`,
    ),
  ];
}

/**
 * The way out of a failed `db migrate` apply: every path and command it prints works from where the
 * CLI ran, with the `--config` it was given.
 */
export function migrateAdvice(
  failure: MigrationRunnerFailure,
  facts: RunnerFailureFacts,
  failedOnDisk: FailedMigrationOnDisk | undefined,
  invocation: CliInvocation,
): RunnerAdvice {
  const failedMigration =
    failedOnDisk === undefined ? undefined : failedMigrationText(failedOnDisk, invocation);
  if (facts.failedTypeChange !== undefined) {
    return migrateFailedTypeChangeAdvice(facts.failedTypeChange, failedMigration, invocation);
  }
  if (facts.rowsWithoutValue !== undefined) {
    return migrateRowsWithoutValueAdvice(facts.rowsWithoutValue, failedMigration, invocation);
  }
  if (schemaCheckIssues(failure) !== undefined) {
    return migrateSchemaCheckAdvice(failedMigration, invocation);
  }
  if (facts.failedPrecheck !== undefined) {
    return migrateFailedPrecheckAdvice(facts.failedPrecheck, invocation);
  }
  return [
    chooseAction(
      `Fix the issue and re-run \`${cliCommand(invocation, 'db migrate', ['--to', '<contract>'])}\``,
    ),
  ];
}
