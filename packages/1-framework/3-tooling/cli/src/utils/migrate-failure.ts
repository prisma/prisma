import { ifDefined } from '@internal/utils/defined';
import type { MigrateFailure } from '../control-api/types';
import type { CliStructuredError } from './cli-errors';
import { errorPathUnreachable, errorRunnerFailed } from './cli-errors';
import { type CommandLocation, migrateFix } from './runner-failure-advice';

/**
 * A `migrate` apply failure as the CLI's structured error; its advice names paths relative to
 * `projectDir`, and a printed `node` command runs from `location`, the project directory with no
 * `--config` when none is given.
 */
export function mapMigrateFailure(
  failure: MigrateFailure,
  projectDir: string,
  location: CommandLocation = { cwd: projectDir, configPath: undefined },
): CliStructuredError {
  if (failure.code === 'MIGRATION_PATH_NOT_FOUND') {
    return errorPathUnreachable(failure);
  }
  return errorRunnerFailed(failure.summary, {
    why: failure.why ?? 'Migration runner failed',
    fix: migrateFix(failure, projectDir, location),
    meta: failure.meta ?? {},
    ...ifDefined('cause', failure.cause),
  });
}
