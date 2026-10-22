import type { MigrationRunnerFailure } from '@internal/framework-components/control';
import { ifDefined } from '@internal/utils/defined';
import { docsUrlFor } from '@internal/utils/structured-error';
import { ActionableCliError, type CliStructuredError } from './cli-errors';
import { adviceText, type RunnerAdvice } from './runner-advice';

/**
 * A runner failure as the CLI reports it: the runner's code, message, why and meta, unchanged, and
 * the failure itself as `cause`, with the CLI's advice: each way out as a next action, and all of
 * them as `fix` prose.
 */
export function runnerFailureError(
  failure: MigrationRunnerFailure,
  advice: RunnerAdvice,
): CliStructuredError {
  return new ActionableCliError(failure.code, failure.message, {
    ...ifDefined('why', failure.why),
    fix: adviceText(advice),
    nextActions: advice,
    meta: failure.meta,
    docsUrl: docsUrlFor(failure.code),
    cause: failure,
  });
}
