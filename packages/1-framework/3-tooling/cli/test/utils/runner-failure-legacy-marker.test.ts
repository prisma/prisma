import { describe, expect, it } from 'vitest';
import { mapDbInitFailure } from '../../src/utils/db-init-failure';
import { mapDbUpdateFailure } from '../../src/utils/db-update-failure';

const invocation = { cwd: '/work/app', configPath: undefined, dbGiven: false };

const legacyMarker = {
  code: 'RUNNER_FAILED',
  summary: 'Legacy marker-table shape detected',
  why: undefined,
  conflicts: undefined,
  meta: {},
  legacyMarkerLocation: 'marker_table_of_the_target',
} as const;

describe('a marker an earlier version wrote', () => {
  it('names where the target keeps it in the db init fix', () => {
    expect(mapDbInitFailure(legacyMarker, invocation).fix).toBe(
      'The marker has the shape an earlier version wrote. Drop `marker_table_of_the_target` and re-run `{bin} db init` to recreate it with the current per-space shape.',
    );
  });

  it('names where the target keeps it in the db update fix', () => {
    expect(mapDbUpdateFailure(legacyMarker, invocation).fix).toBe(
      'The marker has the shape an earlier version wrote. Drop `marker_table_of_the_target` and re-run `{bin} db init` to recreate it with the current per-space shape.',
    );
  });

  it('gives the generic advice when the runner names no marker, whatever its meta says', () => {
    const { legacyMarkerLocation: _, ...noLocation } = legacyMarker;
    const failure = { ...noLocation, meta: { runnerErrorCode: 'MIGRATION.LEGACY_MARKER_SHAPE' } };
    expect(mapDbUpdateFailure(failure, invocation).fix).toBe(
      'Inspect the reported conflict, reconcile schema drift if needed, then re-run `{bin} db update`',
    );
  });
});
