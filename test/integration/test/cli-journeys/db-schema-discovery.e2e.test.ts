/**
 * Live Schema Discovery (Journey AA)
 *
 * A developer inspects an existing database before and after manual DDL.
 * `db schema` must stay read-only while reflecting the live schema in both
 * human-readable and JSON forms.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { withClient } from '@repo/test-utils';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  type JourneyContext,
  parseJsonOutput,
  runDbSchema,
  setupJourney,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

const CREATE_BASE_SCHEMA = `
  CREATE TABLE "user" (
    id int4 PRIMARY KEY,
    email text NOT NULL
  );
`;

withTempDir(({ createTempDir }) => {
  describe('Journey AA: Live Schema Discovery', () => {
    const db = useDevDatabase({
      onReady: (cs) => withClient(cs, (client) => client.query(CREATE_BASE_SCHEMA)),
    });

    it(
      'inspect → manual DDL → inspect again as json, staying read-only throughout',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
        });

        const schemaTree = await runDbSchema(ctx);
        expect(schemaTree.exitCode, 'AA.01: db schema').toBe(0);
        expect(stripAnsi(schemaTree.stderr), 'AA.01: shows user table').toContain('table user');
        expect(stripAnsi(schemaTree.stderr), 'AA.01: shows email column').toContain('email');
        expect(
          existsSync(join(ctx.testDir, 'output/contract.json')),
          'AA.01: no contract json',
        ).toBe(false);
        expect(
          existsSync(join(ctx.testDir, 'output/contract.prisma')),
          'AA.01: no inferred psl',
        ).toBe(false);

        await withClient(db.connectionString, async (client) => {
          await client.query('ALTER TABLE "user" ADD COLUMN name text');
          await client.query(`
            CREATE TABLE "post" (
              id int4 PRIMARY KEY,
              title text NOT NULL,
              "userId" int4 REFERENCES "user"(id)
            )
          `);
        });

        const schemaJson = await runDbSchema(ctx, ['--json']);
        expect(schemaJson.exitCode, 'AA.02: db schema --json').toBe(0);
        const schemaData = parseJsonOutput(schemaJson);
        expect(schemaData, 'AA.02: json envelope').toMatchObject({
          ok: true,
          summary: 'Schema read successfully',
          schema: expect.any(Object),
        });
        const schemaJsonText = JSON.stringify(schemaData['schema']);
        expect(schemaJsonText, 'AA.02: shows added table').toContain('"post"');
        expect(schemaJsonText, 'AA.02: shows added column').toContain('"name"');
        expect(
          existsSync(join(ctx.testDir, 'output/contract.json')),
          'AA.02: still no contract json',
        ).toBe(false);
        expect(
          existsSync(join(ctx.testDir, 'output/contract.prisma')),
          'AA.02: still no inferred psl',
        ).toBe(false);
      },
      timeouts.spinUpPpgDev,
    );
  });
});
