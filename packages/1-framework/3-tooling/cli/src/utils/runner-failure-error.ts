import type { MigrationRunnerFailure } from '@internal/framework-components/control';
import { ifDefined } from '@internal/utils/defined';
import type { RunnerFailureFacts } from '../control-api/types';
import { CliStructuredError } from './cli-errors';
import { failedPrecheckWhy } from './failed-precheck-advice';
import { schemaCheckWhy } from './schema-issues';

/**
 * A runner failure as the CLI reports it: the runner's code, message and meta, and the failure
 * itself as `cause`, with the CLI's `fix`. The why lists the issues of a failed schema check, or
 * explains a failed precheck the runner did not explain.
 */
export function runnerFailureError(
  failure: MigrationRunnerFailure,
  facts: RunnerFailureFacts,
  advice: { readonly fix: string; readonly meta?: Record<string, unknown> },
): CliStructuredError {
  const why =
    schemaCheckWhy(facts.schemaIssues) ??
    failure.why ??
    (facts.failedPrecheck === undefined ? undefined : failedPrecheckWhy(facts.failedPrecheck));
  return new CliStructuredError(failure.code, failure.message, {
    ...ifDefined('why', why),
    fix: advice.fix,
    meta: { ...failure.meta, ...advice.meta },
    cause: failure,
  });
}
