import {
  type MigrationRunnerFailureMeta,
  migrationRunnerFailure,
} from '@internal/framework-components/control';
import { describe, expect, it } from 'vitest';
import { reportedRunnerFailure } from '../../src/control-api/operations/run-migration';

const failed = (meta: MigrationRunnerFailureMeta) =>
  migrationRunnerFailure(
    'MIGRATION.EXECUTION_FAILED',
    'Operation table.Post failed during execution: create table "Post"',
    { why: 'Table already exists.', meta },
  );

describe('reportedRunnerFailure', () => {
  it('names the space a per-space apply stopped at and says the spaces before it stay applied', () => {
    const failure = failed({ failingSpace: 'app', databaseUnchanged: false });

    const reported = reportedRunnerFailure(failure, 'per-space', 'migrate');

    expect({
      code: reported.code,
      message: reported.message,
      why: reported.why,
      meta: reported.meta,
    }).toEqual({
      code: 'MIGRATION.EXECUTION_FAILED',
      message:
        'Migration failed in space "app". Spaces applied before it stay applied; run db migrate again to finish.',
      why: 'Operation table.Post failed during execution: create table "Post". Table already exists.',
      meta: { failingSpace: 'app', databaseUnchanged: false },
    });
  });

  it('names the command that applied, so the user runs the same one again', () => {
    const failure = failed({ failingSpace: 'app', databaseUnchanged: false });

    expect(reportedRunnerFailure(failure, 'per-space', 'dbUpdate').message).toBe(
      'Migration failed in space "app". Spaces applied before it stay applied; run db update again to finish.',
    );
  });

  it('keeps the failure of an apply that changed nothing', () => {
    const failure = failed({ failingSpace: 'app', databaseUnchanged: true });

    expect(reportedRunnerFailure(failure, 'per-space', 'migrate')).toBe(failure);
  });

  it('keeps the failure of a target whose failed apply rolls back every space', () => {
    const failure = failed({ failingSpace: 'app', databaseUnchanged: false });

    expect(reportedRunnerFailure(failure, 'all-spaces', 'migrate')).toBe(failure);
  });
});
