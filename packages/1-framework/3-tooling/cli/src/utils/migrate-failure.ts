import { ifDefined } from '@internal/utils/defined';
import type { MigrateFailure } from '../control-api/types';
import type { CliStructuredError } from './cli-errors';
import { errorPathUnreachable, errorRunnerFailed } from './cli-errors';
import { migrateFix } from './runner-failure-advice';

/**
 * A `migrate` apply failure as the CLI's structured error; its advice names paths relative to
 * `projectDir`, and a printed `node` command repeats the `--config` the CLI was given.
 */
export function mapMigrateFailure(
  failure: MigrateFailure,
  projectDir: string,
  configPath?: string,
): CliStructuredError {
  if (failure.code === 'MIGRATION_PATH_NOT_FOUND') {
    return errorPathUnreachable(failure);
  }
  return errorRunnerFailed(failure.summary, {
    why: failure.why ?? 'Migration runner failed',
    fix: migrateFix(failure, projectDir, configPath),
    meta: failure.meta ?? {},
    ...ifDefined('cause', failure.cause),
  });
}
