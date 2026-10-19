import { ifDefined } from '@internal/utils/defined';
import { assertNever } from '@internal/utils/internal-error';
import type { DbUpdateFailure } from '../control-api/types';
import type { CliStructuredError } from './cli-errors';
import { errorMigrationPlanningFailed, errorRunnerFailed } from './cli-errors';
import { failedPrecheckWhy } from './failed-precheck-advice';
import { type CliInvocation, cliCommand } from './printed-command';
import {
  dbUpdateFailedTypeChangeFix,
  dbUpdateRowsWithoutValueFix,
  legacyMarkerFix,
} from './runner-failure-advice';
import { schemaCheckWhy } from './schema-issues';

/**
 * A `db update` failure as the CLI's structured error.
 *
 * The `assertNever` is deliberate: a control-API failure code this does not
 * handle must stop the command rather than degrade into a generic message.
 */
export function mapDbUpdateFailure(
  failure: DbUpdateFailure,
  invocation: CliInvocation,
): CliStructuredError {
  if (failure.code === 'PLANNING_FAILED') {
    return errorMigrationPlanningFailed({ conflicts: failure.conflicts ?? [] });
  }

  if (failure.code === 'RUNNER_FAILED') {
    const fix =
      failure.failedTypeChange !== undefined
        ? dbUpdateFailedTypeChangeFix(
            failure.failedTypeChange,
            failure.databaseStorageHash,
            invocation,
          )
        : failure.rowsWithoutValue !== undefined
          ? dbUpdateRowsWithoutValueFix(
              failure.rowsWithoutValue,
              failure.databaseStorageHash,
              invocation,
            )
          : failure.schemaIssues !== undefined
            ? `Change the contract source to resolve the issues listed, re-run \`${cliCommand(invocation, 'contract emit')}\`, then re-run \`${cliCommand(invocation, 'db update')}\`.`
            : failure.legacyMarkerLocation !== undefined
              ? legacyMarkerFix(failure.legacyMarkerLocation, cliCommand(invocation, 'db init'))
              : `Inspect the reported conflict, reconcile schema drift if needed, then re-run \`${cliCommand(invocation, 'db update')}\``;
    return errorRunnerFailed(failure.summary, {
      why:
        schemaCheckWhy(failure.schemaIssues) ??
        failure.why ??
        (failure.failedPrecheck === undefined
          ? 'Migration runner failed'
          : failedPrecheckWhy(failure.failedPrecheck)),
      fix,
      meta: {
        ...failure.meta,
        ...(failure.warnings && failure.warnings.length > 0
          ? { plannerWarnings: failure.warnings }
          : {}),
      },
      ...ifDefined('cause', failure.cause),
    });
  }

  const exhaustive: never = failure.code;
  return assertNever(exhaustive, `Unhandled DbUpdateFailure code: ${String(exhaustive)}`);
}
