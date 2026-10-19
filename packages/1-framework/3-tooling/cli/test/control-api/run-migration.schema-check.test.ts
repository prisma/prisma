/**
 * A failed schema check after apply: the run failure carries the runner's typed issues, and names the last migration as the one to plan again.
 */
import type {
  DiffableNode,
  MigrationRunnerFailure,
  SchemaDiffIssue,
} from '@internal/framework-components/control';
import { describe, expect, it } from 'vitest';
import { failureOf } from './run-migration-harness';

const node: DiffableNode = {
  id: 'default',
  nodeKind: 'sql-column-default',
  isEqualTo: () => false,
  children: () => [],
};
const issue: SchemaDiffIssue = { path: ['public', 'event', 'id'], expected: node };

const schemaCheckFailed: MigrationRunnerFailure = {
  code: 'MIGRATION.SCHEMA_VERIFY_FAILED',
  summary: 'Database schema does not satisfy contract',
  failingSpace: 'app',
  schemaIssues: [issue],
};

describe('runMigration, a failed schema check after apply', () => {
  it('carries the issues and names the last migration to plan again', async () => {
    const failure = await failureOf(schemaCheckFailed, null);
    expect({
      schemaIssues: failure?.schemaIssues,
      spaceId: failure?.failedMigration?.spaceId,
    }).toEqual({ schemaIssues: [issue], spaceId: 'app' });
  });

  it('names no migration when the runner reports no issues', async () => {
    const { schemaIssues: _, ...withoutIssues } = schemaCheckFailed;
    const failure = await failureOf(withoutIssues, null);
    expect({
      schemaIssues: failure?.schemaIssues,
      failedMigration: failure?.failedMigration,
    }).toEqual({ schemaIssues: undefined, failedMigration: undefined });
  });
});
