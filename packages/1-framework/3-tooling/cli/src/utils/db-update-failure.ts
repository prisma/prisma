import type {
  MigrationPlannerConflict,
  MigrationRunnerFailure,
} from '@internal/framework-components/control';
import type { RunnerFailureFacts } from '../control-api/types';
import type { CliStructuredError } from './cli-errors';
import { type CliInvocation, cliCommand } from './printed-command';
import { dbUpdateFailedTypeChangeFix, dbUpdateRowsWithoutValueFix } from './runner-failure-advice';
import { runnerFailureError } from './runner-failure-error';

/**
 * A failed `db update` apply as the CLI reports it. `databaseStorageHash` is the contract the
 * database is at when a migration of the graph ends at it: the origin a `migration plan` for this
 * database starts from. The planner's warnings stay in `meta`.
 */
export function dbUpdateRunnerFailureError(
  failure: MigrationRunnerFailure,
  facts: RunnerFailureFacts,
  context: {
    readonly databaseStorageHash: string | undefined;
    readonly plannerWarnings: readonly MigrationPlannerConflict[] | undefined;
    readonly invocation: CliInvocation;
  },
): CliStructuredError {
  const { databaseStorageHash, invocation } = context;
  const fix =
    facts.failedTypeChange !== undefined
      ? dbUpdateFailedTypeChangeFix(facts.failedTypeChange, databaseStorageHash, invocation)
      : facts.rowsWithoutValue !== undefined
        ? dbUpdateRowsWithoutValueFix(facts.rowsWithoutValue, databaseStorageHash, invocation)
        : facts.schemaIssues !== undefined
          ? `Change the contract source to resolve the issues listed, re-run \`${cliCommand(invocation, 'contract emit')}\`, then re-run \`${cliCommand(invocation, 'db update')}\`.`
          : `Inspect the reported conflict, reconcile schema drift if needed, then re-run \`${cliCommand(invocation, 'db update')}\``;
  const warnings = context.plannerWarnings ?? [];
  return runnerFailureError(failure, {
    fix,
    ...(warnings.length > 0 ? { meta: { plannerWarnings: warnings } } : {}),
  });
}
