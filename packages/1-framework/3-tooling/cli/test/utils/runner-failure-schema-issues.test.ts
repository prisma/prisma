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
  rolledBack = true,
): MigrationRunnerFailure {
  return migrationRunnerFailure(
    'MIGRATION.SCHEMA_VERIFY_FAILED',
    'Database schema does not satisfy contract',
    {
      why: (issues === undefined ? undefined : schemaCheckWhy(issues)) ?? RUNNER_WHY,
      meta: issues === undefined ? { rolledBack } : { schemaIssues: issues, rolledBack },
    },
  );
}

const CAUSES = (file: string) =>
  `The database the migration left does not match its destination contract. Either the contract source does not describe the schema you want, or ${file} does not reach its destination contract, for example after a hand edit.`;

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
        fix: `The failed apply changed nothing. ${CAUSES('`migrations/app/20261015T1200_initial/migration.ts`')} If the contract source is wrong, change it to resolve the issues listed, re-run \`{bin} contract emit\`, delete \`migrations/app/20261015T1200_initial\` (copy any code you wrote in its migration.ts first), plan it again with \`{bin} migration plan --from ${FROM} --name initial\`, put any code you copied into the migration.ts it writes, run that migration.ts with the \`node\` command \`migration plan\` prints, and run \`{bin} db migrate\`. Or if \`migrations/app/20261015T1200_initial/migration.ts\` is wrong, change its operations to resolve the issues listed, run \`node migrations/app/20261015T1200_initial/migration.ts\`, and run \`{bin} db migrate\`.`,
        meta: { schemaIssues: [explained, plain], rolledBack: true },
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
        `The failed apply changed nothing. ${CAUSES('the migration.ts of the failed migration')} If the contract source is wrong, change it to resolve the issues listed, re-run \`{bin} contract emit\`, delete the failed migration's directory (copy any code you wrote in its migration.ts first), plan it again with \`{bin} migration plan\`, put any code you copied into the migration.ts it writes, run that migration.ts with the \`node\` command \`migration plan\` prints, and run \`{bin} db migrate\`. Or if the migration.ts of the failed migration is wrong, change its operations to resolve the issues listed, run that file with node, and run \`{bin} db migrate\`.`,
      );
    });

    it('gives each cause its own next action', () => {
      const failed = { directory: `${PROJECT}/migrations/app/20261015T1200_initial`, from: FROM };
      expect(
        migrateError(schemaCheckFailure([plain]), failed).nextActions?.map(({ kind, command }) => ({
          kind,
          command,
        })),
      ).toEqual([
        { kind: 'run-command', command: `{bin} migration plan --from ${FROM} --name initial` },
        { kind: 'edit-file', command: undefined },
      ]);
    });

    it('says the operations that ran stay applied when the runner did not roll back, as on MongoDB', () => {
      const { fix } = migrateError(schemaCheckFailure([plain], false));
      expect({
        changedNothing: fix?.includes('changed nothing'),
        stays: fix?.startsWith('The operations that ran before the failure stay applied.'),
      }).toEqual({ changedNothing: false, stays: true });
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
        fix: 'Inspect the reported conflict, reconcile schema drift if needed, then re-run `{bin} db update`.',
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

  it("reports the runner's why unchanged on every command, and says where things stand in the reason of each next action", () => {
    const failure = schemaCheckFailure([plain]);
    const errors = [migrateError(failure), dbUpdateError(failure), dbInitError(failure)];
    expect(errors.map((error) => error.why)).toEqual([failure.why, failure.why, failure.why]);
    expect(errors[0]?.nextActions?.map(({ reason }) => reason)).toEqual([
      `The failed apply changed nothing. ${CAUSES('the migration.ts of the failed migration')}`,
      `The failed apply changed nothing. ${CAUSES('the migration.ts of the failed migration')}`,
    ]);
  });
});
