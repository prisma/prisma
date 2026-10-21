import {
  failedPrecheckWhy,
  migrationRunnerFailure,
  type SchemaDiffIssue,
} from '@internal/framework-components/control';
import { ifDefined } from '@internal/utils/defined';
import type { RunnerFailureFacts } from '../../src/control-api/types';
import type { CliStructuredError } from '../../src/utils/cli-errors';
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
  readonly schemaIssues?: readonly SchemaDiffIssue[];
  readonly databaseStorageHash?: string;
  readonly conflicts?: undefined;
  /** Whether the failed apply was rolled back; the SQL runners say it was. */
  readonly rolledBack?: boolean | undefined;
}

/** The failure as a runner builds it: it explains a failed precheck it has no other words for. */
function runnerFailureOf(input: AdviceInput) {
  const precheck = input.failedPrecheck;
  return migrationRunnerFailure('MIGRATION.EXECUTION_FAILED', input.summary, {
    why:
      input.why ??
      (precheck === undefined
        ? undefined
        : failedPrecheckWhy({
            operationId: precheck.operationId,
            phase: 'precheck',
            description: precheck.description,
          })),
    meta: {
      ...ifDefined('schemaIssues', input.schemaIssues),
      ...ifDefined('rolledBack', 'rolledBack' in input ? input.rolledBack : true),
    },
  });
}

function factsOf(input: AdviceInput): RunnerFailureFacts {
  return {
    ...ifDefined('failedTypeChange', input.failedTypeChange),
    ...ifDefined('rowsWithoutValue', input.rowsWithoutValue),
    ...ifDefined('failedPrecheck', input.failedPrecheck),
  };
}

/**
 * The error, with `advice`: what the CLI added to the runner's why, then its `fix`, as one text, so
 * a test reads the whole advice in the order the CLI prints it.
 */
function withAdvice(error: CliStructuredError, runnerWhy: string | undefined) {
  const added = (error.why ?? '').slice((runnerWhy ?? '').length).trim();
  return Object.assign(error, {
    advice: [added, error.fix ?? ''].filter((text) => text !== '').join(' '),
  });
}

export function migrateError(input: AdviceInput, invocation: CliInvocation) {
  const failure = runnerFailureOf(input);
  return withAdvice(
    migrateRunnerFailureError(failure, factsOf(input), input.failedMigration, invocation),
    failure.why,
  );
}

export function dbUpdateError(input: AdviceInput, invocation: CliInvocation) {
  const failure = runnerFailureOf(input);
  return withAdvice(
    dbUpdateRunnerFailureError(failure, factsOf(input), {
      databaseStorageHash: input.databaseStorageHash,
      invocation,
    }),
    failure.why,
  );
}

export function dbInitError(input: AdviceInput, invocation: CliInvocation) {
  const failure = runnerFailureOf(input);
  return withAdvice(dbInitRunnerFailureError(failure, factsOf(input), invocation), failure.why);
}
