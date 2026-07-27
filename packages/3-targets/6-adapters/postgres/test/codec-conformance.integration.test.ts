/**
 * Runs the codec JSON-projection conformance harness against a live PostgreSQL
 * for every built-in codec descriptor.
 *
 * A case with no `notYetCanonical` reason must conform; a case carrying one
 * must still fail, so a projection that becomes canonical cannot leave a stale
 * entry behind in the work list.
 */

import postgresControlDriverDescriptor from '@prisma-next/driver-postgres/control';
import { postgresCodecDescriptorRegistry } from '@prisma-next/target-postgres/codecs';
import { createDevDatabase, timeouts } from '@prisma-next/test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { postgresConformanceCases } from './codec-conformance/cases';
import type { ConformanceConnection } from './codec-conformance/harness';
import { runPostgresCodecProjection } from './codec-conformance/harness';

describe.sequential('PostgreSQL codec JSON-projection conformance', () => {
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

  it('registers a representative value for every built-in descriptor', () => {
    const covered = new Set(postgresConformanceCases.map((entry) => entry.codecId));
    const uncovered = [...postgresCodecDescriptorRegistry.values()]
      .map((descriptor) => descriptor.codecId)
      .filter((codecId) => !covered.has(codecId));

    expect(uncovered).toEqual([]);
  });

  for (const conformanceCase of postgresConformanceCases) {
    const expectation =
      conformanceCase.notYetCanonical === undefined
        ? 'projects canonical JSON'
        : 'has no canonical projection yet';

    it(`${conformanceCase.codecId} (${conformanceCase.label}) ${expectation}`, {
      timeout: timeouts.spinUpPpgDev,
    }, async () => {
      const outcome = await runPostgresCodecProjection(connection!, conformanceCase);

      if (conformanceCase.notYetCanonical === undefined) {
        expect(outcome.mismatch ?? 'conforms').toBe('conforms');
      } else {
        expect(outcome.conforms).toBe(false);
      }
    });
  }
});
