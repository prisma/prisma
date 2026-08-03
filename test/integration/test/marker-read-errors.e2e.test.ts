import { withClient } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { withTempDir } from './utils/cli-test-helpers';
import {
  runContractEmit,
  runDbInit,
  runDbVerify,
  setupJourney,
  timeouts,
  useDevDatabase,
} from './utils/journey-test-helpers';

function extractJson(text: string): Record<string, unknown> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in output:\n${text}`);
  }
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

withTempDir(({ createTempDir }) => {
  describe('marker read typed errors (PostgreSQL)', () => {
    const db = useDevDatabase();

    it(
      'returns CONTRACT.MARKER_ROW_CORRUPT when marker row has invalid invariants',
      async () => {
        const ctx = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
        });

        const emit = await runContractEmit(ctx);
        expect(emit.exitCode).toBe(0);
        const init = await runDbInit(ctx);
        expect(init.exitCode).toBe(0);

        await withClient(db.connectionString, async (client) => {
          await client.query(
            'ALTER TABLE prisma_contract.marker ALTER COLUMN invariants DROP NOT NULL',
          );
          await client.query(
            `UPDATE prisma_contract.marker SET invariants = NULL WHERE space = 'app'`,
          );
        });

        const verifyFail = await runDbVerify(ctx, ['--json', '--no-color']);
        expect(verifyFail.exitCode).not.toBe(0);

        const envelope = extractJson(`${verifyFail.stdout}\n${verifyFail.stderr}`);
        expect(envelope).toMatchObject({
          code: 'CONTRACT.MARKER_ROW_CORRUPT',
          summary: 'Marker row is corrupt or incompatible',
          why: expect.stringContaining('Invalid contract marker row'),
          fix: expect.stringContaining('prisma-next db sign'),
        });
      },
      timeouts.spinUpPpgDev,
    );
  });
});
