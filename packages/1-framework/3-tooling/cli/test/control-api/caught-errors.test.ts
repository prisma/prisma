import { errorInvalidRefName } from '@internal/migration-tools/errors';
import { describe, expect, it } from 'vitest';
import { mapCaughtMigrationError } from '../../src/control-api/operations/caught-errors';
import { errorRuntime, mapMigrationToolsError } from '../../src/utils/cli-errors';

describe('mapCaughtMigrationError', () => {
  it('returns a CliStructuredError unchanged', () => {
    const error = errorRuntime('already structured');
    expect(mapCaughtMigrationError(error)).toBe(error);
  });

  it('maps a MigrationToolsError through mapMigrationToolsError', () => {
    const error = errorInvalidRefName('Bad Name');
    const mapped = mapCaughtMigrationError(error);
    expect(mapped?.toEnvelope()).toEqual(mapMigrationToolsError(error).toEnvelope());
  });

  it('returns null for anything else so the caller rethrows or wraps', () => {
    expect(mapCaughtMigrationError(new Error('plain'))).toBeNull();
    expect(mapCaughtMigrationError('string failure')).toBeNull();
  });
});
