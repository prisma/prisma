/**
 * Classifies errors caught around migration-tools calls so commands never import the MigrationToolsError class directly.
 */

import { CliStructuredError } from '../../utils/cli-errors';

/** CliStructuredError (including MigrationToolsError) → identity; anything else → null (caller rethrows/wraps). */
export function mapCaughtMigrationError(error: unknown): CliStructuredError | null {
  if (CliStructuredError.is(error)) {
    return error;
  }
  return null;
}
