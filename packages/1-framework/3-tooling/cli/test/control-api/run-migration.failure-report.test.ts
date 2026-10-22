import {
  type MigrationRunnerFailureMeta,
  migrationRunnerFailure,
} from '@internal/framework-components/control';
import { describe, expect, it } from 'vitest';
import { reportedRunnerFailure } from '../../src/control-api/operations/run-migration';
import { runFailure } from './run-migration-harness';

const failed = (meta: MigrationRunnerFailureMeta) =>
  migrationRunnerFailure(
    'MIGRATION.EXECUTION_FAILED',
    'Operation table.Post failed during execution: create table "Post"',
    { why: 'Table already exists.', meta },
  );

const reportedFields = (failure: ReturnType<typeof failed>) => ({
  code: failure.code,
  message: failure.message,
  why: failure.why,
  meta: failure.meta,
});

describe('reportedRunnerFailure', () => {
  it('keeps the runner message as the headline and adds that changes stay when the apply changed the database', () => {
    const reported = reportedRunnerFailure(
      failed({ failingSpace: 'app', databaseUnchanged: false }),
    );

    expect(reportedFields(reported)).toEqual({
      code: 'MIGRATION.EXECUTION_FAILED',
      message:
        'Operation table.Post failed during execution: create table "Post"\nChanges made before the failure stay in the database.',
      why: 'Table already exists.',
      meta: { failingSpace: 'app', databaseUnchanged: false },
    });
  });

  it('keeps the failure of an apply that changed nothing', () => {
    const failure = failed({ failingSpace: 'app', databaseUnchanged: true });

    expect(reportedRunnerFailure(failure)).toBe(failure);
  });

  it('keeps the failure of a runner that does not say whether the database changed', () => {
    const failure = failed({ failingSpace: 'app' });

    expect(reportedRunnerFailure(failure)).toBe(failure);
  });
});

describe('runMigration, a failed apply', () => {
  it('reports that changes stay when the apply changed the database', async () => {
    const failure = await runFailure(failed({ failingSpace: 'app', databaseUnchanged: false }));

    expect(failure?.message).toBe(
      'Operation table.Post failed during execution: create table "Post"\nChanges made before the failure stay in the database.',
    );
  });

  it('reports the runner failure unchanged when the apply changed nothing', async () => {
    const runnerFailure = failed({ failingSpace: 'app', databaseUnchanged: true });

    expect(await runFailure(runnerFailure)).toBe(runnerFailure);
  });
});
