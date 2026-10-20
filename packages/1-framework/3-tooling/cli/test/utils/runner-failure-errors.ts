import { migrationRunnerFailure } from '@internal/framework-components/control';
import { ifDefined } from '@internal/utils/defined';
import type { RunnerFailureFacts } from '../../src/control-api/types';
import { dbInitRunnerFailureError } from '../../src/utils/db-init-failure';
import { dbUpdateRunnerFailureError } from '../../src/utils/db-update-failure';
import { migrateRunnerFailureError } from '../../src/utils/migrate-failure';
import type { CliInvocation } from '../../src/utils/printed-command';
import type { FailedMigrationOnDisk } from '../../src/utils/runner-failure-advice';

/** A runner failure and the facts its advice names, as the advice tests state them. */
interface AdviceInput extends Omit<RunnerFailureFacts, 'failedMigration'> {
  readonly summary: string;
  readonly why: string | undefined;
  readonly failedMigration?: FailedMigrationOnDisk;
  readonly databaseStorageHash?: string;
  readonly conflicts?: undefined;
}

function runnerFailureOf(input: AdviceInput) {
  return migrationRunnerFailure('MIGRATION.EXECUTION_FAILED', input.summary, {
    why: input.why,
  });
}

function factsOf(input: AdviceInput): RunnerFailureFacts {
  return {
    ...ifDefined('failedTypeChange', input.failedTypeChange),
    ...ifDefined('rowsWithoutValue', input.rowsWithoutValue),
    ...ifDefined('failedPrecheck', input.failedPrecheck),
    ...ifDefined('schemaIssues', input.schemaIssues),
  };
}

export function migrateError(input: AdviceInput, invocation: CliInvocation) {
  return migrateRunnerFailureError(
    runnerFailureOf(input),
    factsOf(input),
    input.failedMigration,
    invocation,
  );
}

export function dbUpdateError(input: AdviceInput, invocation: CliInvocation) {
  return dbUpdateRunnerFailureError(runnerFailureOf(input), factsOf(input), {
    databaseStorageHash: input.databaseStorageHash,
    plannerWarnings: undefined,
    invocation,
  });
}

export function dbInitError(input: AdviceInput, invocation: CliInvocation) {
  return dbInitRunnerFailureError(runnerFailureOf(input), factsOf(input), invocation);
}
