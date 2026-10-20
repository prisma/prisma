import {
  type DiffableNode,
  type MigrationRunnerFailure,
  migrationRunnerFailure,
  type SchemaDiffIssue,
  schemaCheckWhy,
} from '@internal/framework-components/control';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { describe, expect, it } from 'vitest';
import { runnerFailureFacts } from '../../src/control-api/operations/run-migration';
import { dbInitRunnerFailureError } from '../../src/utils/db-init-failure';
import { dbUpdateRunnerFailureError } from '../../src/utils/db-update-failure';
import { migrateRunnerFailureError } from '../../src/utils/migrate-failure';
import type { FailedMigrationOnDisk } from '../../src/utils/runner-failure-advice';

const node: DiffableNode = {
  id: 'default',
  nodeKind: 'sql-column-default',
  isEqualTo: () => false,
  children: () => [],
};

const explained: SchemaDiffIssue = {
  path: ['database', 'public', 'Event', 'column:at', 'default'],
  expected: node,
  actual: node,
  explanation: {
    text: 'The database reads this default back as sql`(now())`.',
    cause: 'possibly-equivalent',
  },
};
const plain: SchemaDiffIssue = {
  path: ['database', 'public', 'Event', 'column:id'],
  expected: node,
};

const RUNNER_WHY = 'The resulting database schema does not satisfy the destination contract.';
const LISTED =
  'The schema check after apply found: mismatch: database/public/Event/column:at/default. The database reads this default back as sql`(now())`; missing: database/public/Event/column:id.';
const PROJECT = '/work/app';
const invocation = { cwd: PROJECT, configPath: undefined, dbGiven: false };
const FROM = 'b'.repeat(64);

function schemaCheckFailure(
  issues: readonly SchemaDiffIssue[] | undefined,
): MigrationRunnerFailure {
  return migrationRunnerFailure(
    'MIGRATION.SCHEMA_VERIFY_FAILED',
    'Database schema does not satisfy contract',
    {
      why: (issues === undefined ? undefined : schemaCheckWhy(issues)) ?? RUNNER_WHY,
      meta: issues === undefined ? {} : { schemaIssues: issues },
    },
  );
}

const withoutIssues = schemaCheckFailure(undefined);

function migrateError(
  failure: MigrationRunnerFailure,
  failedMigration: FailedMigrationOnDisk | undefined = undefined,
) {
  return migrateRunnerFailureError(
    failure,
    runnerFailureFacts(failure, []),
    failedMigration,
    invocation,
  );
}

function dbUpdateError(failure: MigrationRunnerFailure) {
  return dbUpdateRunnerFailureError(failure, runnerFailureFacts(failure, []), {
    databaseStorageHash: undefined,
    invocation,
  });
}

function dbInitError(failure: MigrationRunnerFailure) {
  return dbInitRunnerFailureError(failure, runnerFailureFacts(failure, []), invocation);
}

describe('a failed schema check after apply', () => {
  describe('on db migrate', () => {
    it('lists the issues in its why, and says how to plan the failed migration again', () => {
      const failure = schemaCheckFailure([explained, plain]);
      const error = migrateError(failure, {
        directory: `${PROJECT}/migrations/app/20261015T1200_initial`,
        from: FROM,
      });
      expect({
        code: error.code,
        message: error.message,
        why: error.why,
        fix: error.fix,
        meta: error.meta,
        cause: error.cause,
      }).toEqual({
        code: 'MIGRATION.SCHEMA_VERIFY_FAILED',
        message: 'Database schema does not satisfy contract',
        why: LISTED,
        fix: `The failed apply changed nothing. Change the contract source to resolve the issues listed, re-run \`{bin} contract emit\`, delete \`migrations/app/20261015T1200_initial\` (copy any code you wrote in its migration.ts first), plan it again with \`{bin} migration plan --from ${FROM} --name initial\`, put any code you copied into the migration.ts it writes, run that migration.ts with the \`node\` command \`migration plan\` prints, and run \`{bin} db migrate\`.`,
        meta: { schemaIssues: [explained, plain] },
        cause: failure,
      });
      expect(error.cause).toBe(failure);
    });

    it('plans the first migration again without --from, which does not take the empty contract', () => {
      expect(
        migrateError(schemaCheckFailure([explained]), {
          directory: `${PROJECT}/migrations/app/20261015T1200_initial`,
          from: EMPTY_CONTRACT_HASH,
        }).fix,
      ).toContain('plan it again with `{bin} migration plan --name initial`,');
    });

    it('says to carry written code over when the runner names no migration', () => {
      expect(migrateError(schemaCheckFailure([explained])).fix).toBe(
        "The failed apply changed nothing. Change the contract source to resolve the issues listed, re-run `{bin} contract emit`, delete the failed migration's directory (copy any code you wrote in its migration.ts first), plan it again with `{bin} migration plan`, put any code you copied into the migration.ts it writes, run that migration.ts with the `node` command `migration plan` prints, and run `{bin} db migrate`.",
      );
    });

    it('keeps the runner why when the check reported no issues', () => {
      expect([migrateError(withoutIssues).why, migrateError(schemaCheckFailure([])).why]).toEqual([
        RUNNER_WHY,
        RUNNER_WHY,
      ]);
    });
  });

  describe('on db update', () => {
    it('lists the issues in its why, and says to change the contract', () => {
      const error = dbUpdateError(schemaCheckFailure([explained, plain]));
      expect({ why: error.why, fix: error.fix }).toEqual({
        why: LISTED,
        fix: 'Change the contract source to resolve the issues listed, re-run `{bin} contract emit`, then re-run `{bin} db update`.',
      });
    });

    it('keeps the runner why and its advice for a failure that carries no issues', () => {
      const error = dbUpdateError(withoutIssues);
      expect({ why: error.why, fix: error.fix }).toEqual({
        why: RUNNER_WHY,
        fix: 'Inspect the reported conflict, reconcile schema drift if needed, then re-run `{bin} db update`',
      });
    });
  });

  describe('on db init', () => {
    it('lists the issues in its why, and says to change the contract', () => {
      const error = dbInitError(schemaCheckFailure([explained, plain]));
      expect({ why: error.why, fix: error.fix }).toEqual({
        why: LISTED,
        fix: 'Change the contract source to resolve the issues listed, re-run `{bin} contract emit`, then re-run `{bin} db init`.',
      });
    });

    it('keeps the runner why for a failure that carries no issues', () => {
      expect(dbInitError(withoutIssues).why).toBe(RUNNER_WHY);
    });
  });
});
