import { withClient } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  runContractEmit,
  runDbInit,
  setupJourney,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

function extractJson(text: string): Record<string, unknown> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in output:\n${text}`);
  }
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

async function plantLegacyMarker(connectionString: string) {
  await withClient(connectionString, async (client) => {
    await client.query('DROP TABLE IF EXISTS prisma_contract.marker CASCADE');
    await client.query(`
      CREATE TABLE prisma_contract.marker (
        core_hash text NOT NULL,
        profile_hash text NOT NULL,
        contract_json jsonb,
        canonical_version int,
        updated_at timestamptz NOT NULL,
        app_tag text,
        meta jsonb NOT NULL DEFAULT '{}',
        invariants text[] NOT NULL DEFAULT '{}'
      )
    `);
    await client.query(`
      INSERT INTO prisma_contract.marker (core_hash, profile_hash, updated_at)
      VALUES ('legacy', 'legacy', NOW())
    `);
  });
}

withTempDir(({ createTempDir }) => {
  describe('marker read typed errors — legacy marker on db init', () => {
    const db = useDevDatabase();

    it(
      'returns MIGRATION.RUNNER_FAILED when legacy marker table lacks space column on db init',
      async () => {
        const ctx = setupJourney({ connectionString: db.connectionString, createTempDir });

        expect((await runContractEmit(ctx)).exitCode).toBe(0);
        expect((await runDbInit(ctx)).exitCode).toBe(0);
        await plantLegacyMarker(db.connectionString);

        const initFail = await runDbInit(ctx, ['--json', '--no-color']);
        expect(initFail.exitCode).not.toBe(0);

        const envelope = extractJson(initFail.stdout);
        expect(envelope['code']).toBe('MIGRATION.RUNNER_FAILED');
        expect(String(envelope['fix'])).toContain('Legacy marker-table shape detected');
        expect(String(envelope['fix'])).toContain('prisma_contract.marker');
        expect(String(envelope['fix'])).toContain('prisma-next db init');
        expect(envelope['code']).not.toBe('CONTRACT.MARKER_READ_FAILED');
      },
      timeouts.spinUpPpgDev,
    );
  });
});
