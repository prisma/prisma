import { ifDefined } from '@internal/utils/defined';
import { statementFlag } from '../control-api/statements/statement-flag';
import type { MigrateFailure } from '../control-api/types';
import type { CliStructuredError } from './cli-errors';
import { errorPathUnreachable, errorRunnerFailed } from './cli-errors';

/** What a runner failure says of a field whose type change met a value the database could not convert. */
export function unconvertibleValue(field: string): string {
  return `A value of field "${field}" cannot be converted to its new type by the database's cast.`;
}

/** A `migrate` apply failure as the CLI's structured error. */
export function mapMigrateFailure(failure: MigrateFailure): CliStructuredError {
  if (failure.code === 'MIGRATION_PATH_NOT_FOUND') {
    return errorPathUnreachable(failure);
  }
  const fix =
    failure.unconvertedField === undefined
      ? 'Fix the issue and re-run `{bin} db migrate --to <contract>` — previously applied migrations are preserved.'
      : `${unconvertibleValue(failure.unconvertedField)} Plan the type change again with \`{bin} migration plan ${statementFlag({ verb: 'convert', text: failure.unconvertedField })}\` in place of this migration, and write the conversion in the migration.ts it writes.`;
  return errorRunnerFailed(failure.summary, {
    why: failure.why ?? 'Migration runner failed',
    fix,
    meta: failure.meta ?? {},
    ...ifDefined('cause', failure.cause),
  });
}
