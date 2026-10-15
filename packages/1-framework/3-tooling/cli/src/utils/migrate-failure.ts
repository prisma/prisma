import type { SchemaDiffIssue } from '@internal/framework-components/control';
import { ifDefined } from '@internal/utils/defined';
import type { MigrateFailure } from '../control-api/types';
import { schemaDiffersWhy } from '../orm/db/verification';
import type { CliStructuredError } from './cli-errors';
import { errorPathUnreachable, errorRunnerFailed } from './cli-errors';
import type { CliInvocation } from './printed-command';
import { migrateFix } from './runner-failure-advice';

/**
 * A `migrate` apply failure as the CLI's structured error; its advice prints paths and commands
 * that work from where the CLI ran, with the `--config` it was given.
 */
export function mapMigrateFailure(
  failure: MigrateFailure,
  invocation: CliInvocation,
): CliStructuredError {
  if (failure.code === 'MIGRATION_PATH_NOT_FOUND') {
    return errorPathUnreachable(failure);
  }
  return errorRunnerFailed(failure.summary, {
    why: schemaCheckWhy(failure) ?? failure.why ?? 'Migration runner failed',
    fix: migrateFix(failure, invocation),
    meta: failure.meta ?? {},
    ...ifDefined('cause', failure.cause),
  });
}

function schemaCheckWhy(failure: MigrateFailure): string | undefined {
  if (failure.meta?.['runnerErrorCode'] !== 'MIGRATION.SCHEMA_VERIFY_FAILED') return undefined;
  const issues = failure.meta['issues'];
  if (!Array.isArray(issues) || issues.length === 0 || !issues.every(isSchemaDiffIssue)) {
    return undefined;
  }
  return schemaDiffersWhy(issues);
}

function isSchemaDiffIssue(value: unknown): value is SchemaDiffIssue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    Array.isArray(value.path) &&
    value.path.every((step) => typeof step === 'string')
  );
}
