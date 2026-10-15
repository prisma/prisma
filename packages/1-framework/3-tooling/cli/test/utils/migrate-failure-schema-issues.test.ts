import type { DiffableNode, SchemaDiffIssue } from '@internal/framework-components/control';
import { describe, expect, it } from 'vitest';
import { mapMigrateFailure } from '../../src/utils/migrate-failure';

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
  explanation: 'The database stores this default as `(now())`.',
  explanationCause: 'equivalent-form',
};
const plain: SchemaDiffIssue = {
  path: ['database', 'public', 'Event', 'column:id'],
  expected: node,
};

const RUNNER_WHY = 'The resulting database schema does not satisfy the destination contract.';
const invocation = { cwd: '/work/app', configPath: undefined, dbGiven: false };

function schemaVerifyFailure(meta: Record<string, unknown>) {
  return {
    code: 'RUNNER_FAILED',
    summary: 'Database schema does not satisfy contract',
    why: RUNNER_WHY,
    meta: { runnerErrorCode: 'MIGRATION.SCHEMA_VERIFY_FAILED', ...meta },
  } as const;
}

describe('a db migrate failure of the schema check after apply', () => {
  it('lists the issues in its why, as db verify does', () => {
    expect(
      mapMigrateFailure(schemaVerifyFailure({ issues: [explained, plain] }), invocation).why,
    ).toBe(
      'The live schema differs: mismatch: database/public/Event/column:at/default. The database stores this default as `(now())`.; missing: database/public/Event/column:id.',
    );
  });

  it('keeps the issues in meta', () => {
    expect(
      mapMigrateFailure(schemaVerifyFailure({ issues: [explained, plain] }), invocation).meta?.[
        'issues'
      ],
    ).toEqual([explained, plain]);
  });

  it('keeps the runner why when there are no issues to list', () => {
    expect(mapMigrateFailure(schemaVerifyFailure({ issues: [] }), invocation).why).toBe(RUNNER_WHY);
  });

  it('keeps the runner why for another runner failure', () => {
    expect(
      mapMigrateFailure(
        {
          ...schemaVerifyFailure({ issues: [explained] }),
          meta: { runnerErrorCode: 'MIGRATION.PRECHECK_FAILED', issues: [explained] },
        },
        invocation,
      ).why,
    ).toBe(RUNNER_WHY);
  });
});
