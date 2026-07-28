/**
 * Conformance for `pg/vector@1` against a real database with the extension
 * installed.
 *
 * The extension's descriptor is not in the target's built-in registry, so each
 * case carries it directly; everything else runs through the same harness the
 * built-in codecs use, so what is asserted here is what is asserted there —
 * parsed projection JSON equals `encodeJson`, and `decodeJson` returns the
 * application value.
 *
 * `CREATE EXTENSION` runs in each case's setup rather than being assumed: if the
 * bundle ever stops shipping, these fail loudly at the point of the missing
 * dependency instead of somewhere downstream.
 */

import postgresControlDriverDescriptor from '@prisma-next/driver-postgres/control';
import { createDevDatabase, timeouts } from '@prisma-next/test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  ConformanceConnection,
  PostgresCodecConformanceCase,
} from '../../../3-targets/6-adapters/postgres/test/codec-conformance/harness';
import { runPostgresCodecProjection } from '../../../3-targets/6-adapters/postgres/test/codec-conformance/harness';
import { pgVectorDescriptor } from '../src/core/codecs';

const INSTALL_VECTOR = ['CREATE EXTENSION IF NOT EXISTS vector'] as const;

function vectorCase(
  label: string,
  value: number[],
  length: number = value.length,
): PostgresCodecConformanceCase {
  return {
    codecId: 'pg/vector@1',
    descriptor: pgVectorDescriptor,
    label,
    value,
    typeParams: { length },
    setupSql: INSTALL_VECTOR,
  };
}

const cases: readonly PostgresCodecConformanceCase[] = [
  vectorCase('three dimensions', [1, 2, 3]),
  // A vector's text form separates elements with commas and wraps them in
  // brackets, so a value has to carry negatives and fractions before the
  // reinterpretation as JSON is doing anything a plain string would not.
  vectorCase('negative and fractional elements', [-1.5, 0, 0.25]),
  vectorCase('a single dimension', [42]),
  // pgvector stores elements as `real`, so a value has to be exactly
  // representable in a 32-bit float to round-trip at all. These are dyadic, and
  // deliberately so: a value like `index / 1536` is not, and would fail for a
  // reason that has nothing to do with the projection.
  vectorCase('elements at the edge of float4 precision', [
    Math.fround(0.1),
    Math.fround(-1 / 3),
    Math.fround(Math.PI),
  ]),
  // A short vector fits any buffer; a wide one is where a text-form assumption
  // would show.
  vectorCase(
    'many dimensions',
    Array.from({ length: 1536 }, (_, index) => index / 2048),
  ),
];

describe.sequential('pgvector codec JSON-projection conformance', () => {
  let database: Awaited<ReturnType<typeof createDevDatabase>> | undefined;
  let driver: Awaited<ReturnType<typeof postgresControlDriverDescriptor.create>> | undefined;
  let connection: ConformanceConnection | undefined;

  beforeAll(async () => {
    database = await createDevDatabase();
    driver = await postgresControlDriverDescriptor.create(database.connectionString);
    connection = { query: async (sql, params) => (await driver!.query(sql, params)).rows };
  }, timeouts.spinUpPpgDev);

  afterAll(async () => {
    await driver?.close();
    driver = undefined;
    connection = undefined;
    await database?.close();
    database = undefined;
  }, timeouts.spinUpPpgDev);

  for (const conformanceCase of cases) {
    it(`pg/vector@1 (${conformanceCase.label}) agrees with encodeJson and round-trips through decodeJson`, {
      timeout: timeouts.spinUpPpgDev,
    }, async () => {
      const outcome = await runPostgresCodecProjection(connection!, conformanceCase);
      expect(outcome.failure?.detail ?? 'conforms').toBe('conforms');
    });
  }
});
