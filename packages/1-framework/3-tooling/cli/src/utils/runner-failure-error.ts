import type { MigrationRunnerFailure } from '@internal/framework-components/control';
import { ifDefined } from '@internal/utils/defined';
import { docsUrlFor } from '@internal/utils/structured-error';
import { CliStructuredError } from './cli-errors';

/**
 * A runner failure as the CLI reports it: the runner's code, message, why and meta, and the failure
 * itself as `cause`, with the CLI's `fix`.
 */
export function runnerFailureError(
  failure: MigrationRunnerFailure,
  advice: { readonly fix: string },
): CliStructuredError {
  return new CliStructuredError(failure.code, failure.message, {
    ...ifDefined('why', failure.why),
    fix: advice.fix,
    meta: failure.meta,
    docsUrl: docsUrlFor(failure.code),
    cause: failure,
  });
}
