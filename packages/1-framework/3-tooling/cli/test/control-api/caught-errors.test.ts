import { errorInvalidRefName } from '@internal/migration-tools/errors';
import { describe, expect, it } from 'vitest';
import { mapCaughtMigrationError } from '../../src/control-api/operations/caught-errors';
import { errorRuntime } from '../../src/utils/cli-errors';

describe('mapCaughtMigrationError', () => {
  it('returns a CliStructuredError unchanged', () => {
    const error = errorRuntime('CLI.UNEXPECTED', 'already structured');
    expect(mapCaughtMigrationError(error)).toBe(error);
  });

  it('passes a MigrationToolsError through unchanged (it is a CliStructuredError)', () => {
    const error = errorInvalidRefName('Bad Name');
    expect(mapCaughtMigrationError(error)).toBe(error);
  });

  it('returns null for anything else so the caller rethrows or wraps', () => {
    expect(mapCaughtMigrationError(new Error('plain'))).toBeNull();
    expect(mapCaughtMigrationError('string failure')).toBeNull();
  });
});
