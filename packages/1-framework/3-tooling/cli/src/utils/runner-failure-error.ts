import type { MigrationRunnerFailure } from '@internal/framework-components/control';
import { ifDefined } from '@internal/utils/defined';
import { docsUrlFor } from '@internal/utils/structured-error';
import { ActionableCliError, type CliStructuredError } from './cli-errors';
import { alternativesText, type RunnerAdvice } from './runner-advice';

/**
 * A runner failure as the CLI reports it: the runner's code, message and meta, and the failure
 * itself as `cause`. The why is the runner's, followed by what the advice says of where things
 * stand; each way out is a next action, and `fix` says them all as prose.
 */
export function runnerFailureError(
  failure: MigrationRunnerFailure,
  advice: RunnerAdvice,
): CliStructuredError {
  const why = [...(failure.why === undefined ? [] : [failure.why]), ...advice.context].join(' ');
  return new ActionableCliError(failure.code, failure.message, {
    ...ifDefined('why', why === '' ? undefined : why),
    fix: alternativesText(advice.alternatives),
    nextActions: advice.alternatives.map(({ action }) => action),
    meta: failure.meta,
    docsUrl: docsUrlFor(failure.code),
    cause: failure,
  });
}
