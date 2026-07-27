/**
 * Runs the codec JSON-projection conformance harness against a live SQLite for
 * every built-in codec descriptor.
 *
 * A case with no `notYetCanonical` reason must conform; a case carrying one
 * must still fail, so a projection that becomes canonical cannot leave a stale
 * entry behind in the work list.
 */

import { DatabaseSync } from 'node:sqlite';
import { sqliteCodecDescriptorRegistry } from '@prisma-next/target-sqlite/codecs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sqliteConformanceCases } from './codec-conformance/cases';
import type { ConformanceConnection } from './codec-conformance/harness';
import { runSqliteCodecProjection } from './codec-conformance/harness';

type SqliteParam = Parameters<ReturnType<DatabaseSync['prepare']>['all']>[number];

describe.sequential('SQLite codec JSON-projection conformance', () => {
  let database: DatabaseSync | undefined;
  let connection: ConformanceConnection | undefined;

  beforeAll(() => {
    database = new DatabaseSync(':memory:');
    connection = {
      query: async (sql, params) =>
        database!.prepare(sql).all(...((params ?? []) as readonly SqliteParam[])),
    };
  });

  afterAll(() => {
    database?.close();
    database = undefined;
    connection = undefined;
  });

  it('registers a representative value for every built-in descriptor', () => {
    const covered = new Set(sqliteConformanceCases.map((entry) => entry.codecId));
    const uncovered = [...sqliteCodecDescriptorRegistry.values()]
      .map((descriptor) => descriptor.codecId)
      .filter((codecId) => !covered.has(codecId));

    expect(uncovered).toEqual([]);
  });

  for (const conformanceCase of sqliteConformanceCases) {
    const expectation =
      conformanceCase.notYetCanonical === undefined
        ? 'projects canonical JSON'
        : 'has no canonical projection yet';

    it(`${conformanceCase.codecId} (${conformanceCase.label}) ${expectation}`, async () => {
      const outcome = await runSqliteCodecProjection(connection!, conformanceCase);

      if (conformanceCase.notYetCanonical === undefined) {
        expect(outcome.mismatch ?? 'conforms').toBe('conforms');
      } else {
        expect(outcome.conforms).toBe(false);
      }
    });
  }
});
