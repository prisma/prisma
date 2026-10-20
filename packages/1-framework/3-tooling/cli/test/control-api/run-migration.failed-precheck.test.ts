/**
 * A check that fails before an operation runs: the run failure names the check and says whether the space had a marker, so the advice can tell a replay on an adopted database from drift.
 */
import type { MigrationRunnerFailure } from '@internal/framework-components/control';
import { describe, expect, it } from 'vitest';
import { APP_HASH, failureOf } from './run-migration-harness';

const precheckFailed: MigrationRunnerFailure = {
  code: 'MIGRATION.PRECHECK_FAILED',
  summary: 'Operation column.x failed during precheck: ensure column "x" is missing',
  failingSpace: 'app',
  failedCheck: {
    operationId: 'column.x',
    phase: 'precheck',
    description: 'ensure column "x" is missing',
  },
};

describe('runMigration, a check that failed before an operation', () => {
  it('names the check, and says the plan does not start from a marker when its origin is none', async () => {
    expect((await failureOf(precheckFailed, null))?.failedPrecheck).toEqual({
      operationId: 'column.x',
      description: 'ensure column "x" is missing',
      planStartsFromMarker: false,
    });
  });

  it('says the plan starts from a marker when it has an origin', async () => {
    expect(
      (await failureOf(precheckFailed, { storageHash: APP_HASH }))?.failedPrecheck,
    ).toMatchObject({ planStartsFromMarker: true });
  });

  it('leaves it out when the runner explained the failure itself', async () => {
    expect(
      (await failureOf({ ...precheckFailed, why: 'Renaming would overwrite values.' }, null))
        ?.failedPrecheck,
    ).toBeUndefined();
  });
});
