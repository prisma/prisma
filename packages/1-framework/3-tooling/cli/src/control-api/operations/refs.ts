/**
 * Reads the migrations refs index for commands, mapping MigrationToolsError into the CLI envelope.
 */

import { MigrationToolsError } from '@internal/migration-tools/errors';
import type { Refs } from '@internal/migration-tools/refs';
import { readRefs } from '@internal/migration-tools/refs';
import { notOk, ok, type Result } from '@internal/utils/result';
import type { CliStructuredError } from '../../utils/cli-errors';

/** Reads migrations/<app>/refs, passing MigrationToolsError through; other errors rethrow. */
export async function readMigrationRefs(
  refsDir: string,
): Promise<Result<Refs, CliStructuredError>> {
  try {
    return ok(await readRefs(refsDir));
  } catch (error) {
    if (MigrationToolsError.is(error)) {
      return notOk(error);
    }
    throw error;
  }
}
