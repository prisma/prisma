/**
 * Runs the codec JSON-projection conformance harness against a live SQLite
 * database for every built-in codec descriptor.
 *
 * An unmarked case must conform — its projection must agree with the codec's
 * `encodeJson` and survive the round trip back through `decodeJson`. A marked
 * case must still fail, and fail with the kind it records, so neither the marker
 * nor its recorded kind can rot as projections change.
 *
 * Conformance is measured against the codec's **current** methods, so a green
 * run does not claim every codec's JSON is already canonical: a codec whose
 * `encodeJson` is not yet canonical conforms here and is tracked by the plan.
 * See `codec-conformance/cases.ts`.
 */

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { sqliteCodecDescriptorRegistry } from '@prisma-next/target-sqlite/codecs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sqliteConformanceCases } from './codec-conformance/cases';
import type { ConformanceConnection } from './codec-conformance/harness';
import { runSqliteCodecProjection } from './codec-conformance/harness';

/** Widens a codec wire value to what `node:sqlite` binds as a positional parameter. */
function toSqliteParam(wire: unknown): SQLInputValue {
  if (wire === null) return null;
  if (typeof wire === 'number' || typeof wire === 'bigint' || typeof wire === 'string') return wire;
  if (wire instanceof Uint8Array) return wire;
  throw new Error(`No SQLite parameter binding for a wire value of type ${typeof wire}.`);
}

describe.sequential('SQLite codec JSON-projection conformance', () => {
  let database: DatabaseSync | undefined;
  let connection: ConformanceConnection | undefined;

  beforeAll(() => {
    database = new DatabaseSync(':memory:');
    connection = {
      query: async (sql, params) =>
        database!.prepare(sql).all(...(params ?? []).map(toSqliteParam)),
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
        expect(outcome.failure?.detail ?? 'conforms').toBe('conforms');
      } else {
        expect(outcome.failure?.kind).toBe(conformanceCase.notYetCanonical.kind);
      }
    });
  }
});
