import { ifDefined } from '@internal/utils/defined';
import { statementFlag } from '../control-api/statements/statement-flag';
import type { FailedCastReport, MigrateFailure } from '../control-api/types';
import type { CliStructuredError } from './cli-errors';
import { errorPathUnreachable, errorRunnerFailed } from './cli-errors';

/** What a runner failure says of a type change whose cast failed. */
export function failedCastText(cast: FailedCastReport): string {
  return cast.reason === 'noCast'
    ? `The database has no cast from the old type of field "${cast.field}" to its new type.`
    : `A value of field "${cast.field}" cannot be converted to its new type by the database's cast.`;
}

function failedCastFix(cast: FailedCastReport): string {
  const convert = statementFlag({ verb: 'convert', text: cast.field });
  if (cast.migration === undefined) {
    return `${failedCastText(cast)} Plan the type change again with \`{bin} migration plan ${convert}\`, and write the conversion in the migration.ts it writes.`;
  }
  const { directory, from } = cast.migration;
  return `${failedCastText(cast)} The failed apply changed nothing. Delete the migration directory \`${directory}\`, plan the type change again with \`{bin} migration plan --from ${from} ${convert}\`, write the conversion in the migration.ts it writes, and apply it with \`{bin} db migrate\`.`;
}

/** A `migrate` apply failure as the CLI's structured error. */
export function mapMigrateFailure(failure: MigrateFailure): CliStructuredError {
  if (failure.code === 'MIGRATION_PATH_NOT_FOUND') {
    return errorPathUnreachable(failure);
  }
  const fix =
    failure.failedCast === undefined
      ? 'Fix the issue and re-run `{bin} db migrate --to <contract>` — previously applied migrations are preserved.'
      : failedCastFix(failure.failedCast);
  return errorRunnerFailed(failure.summary, {
    why: failure.why ?? 'Migration runner failed',
    fix,
    meta: failure.meta ?? {},
    ...ifDefined('cause', failure.cause),
  });
}
