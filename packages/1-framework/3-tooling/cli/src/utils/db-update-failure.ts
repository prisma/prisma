import type { MigrationRunnerFailure } from '@internal/framework-components/control';
import type { RunnerFailureFacts } from '../control-api/types';
import type { CliStructuredError } from './cli-errors';
import { type CliInvocation, cliCommand } from './printed-command';
import {
  blockingObjectsFix,
  dbUpdateFailedTypeChangeFix,
  dbUpdateRowsWithoutValueFix,
} from './runner-failure-advice';
import { runnerFailureError } from './runner-failure-error';
import { schemaCheckIssues } from './schema-check-issues';

/**
 * A failed `db update` apply as the CLI reports it. `databaseStorageHash` is the contract the
 * database is at when a migration of the graph ends at it: the origin a `migration plan` for this
 * database starts from.
 */
export function dbUpdateRunnerFailureError(
  failure: MigrationRunnerFailure,
  facts: RunnerFailureFacts,
  context: {
    readonly databaseStorageHash: string | undefined;
    readonly invocation: CliInvocation;
  },
): CliStructuredError {
  const { databaseStorageHash, invocation } = context;
  const { blockingObjects } = failure.meta;
  const fix =
    blockingObjects !== undefined
      ? blockingObjectsFix(
          blockingObjects,
          cliCommand(invocation, 'db update', invocation.rerunArgs ?? []),
        )
      : facts.failedTypeChange !== undefined
        ? dbUpdateFailedTypeChangeFix(facts.failedTypeChange, databaseStorageHash, invocation)
        : facts.rowsWithoutValue !== undefined
          ? dbUpdateRowsWithoutValueFix(facts.rowsWithoutValue, databaseStorageHash, invocation)
          : schemaCheckIssues(failure) !== undefined
            ? `Change the contract source to resolve the issues listed, re-run \`${cliCommand(invocation, 'contract emit')}\`, then re-run \`${cliCommand(invocation, 'db update')}\`.`
            : `Inspect the reported conflict, reconcile schema drift if needed, then re-run \`${cliCommand(invocation, 'db update')}\``;
  return runnerFailureError(failure, { fix });
}
