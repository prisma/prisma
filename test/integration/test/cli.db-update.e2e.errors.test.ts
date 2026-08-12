import { timeouts, withClient, withDevDatabase } from '@repo/test-utils';
import stripAnsi from 'strip-ansi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupCommandMocks, withTempDir } from './utils/cli-test-helpers';
import { runDbInit } from './utils/db-init-test-helpers';
import { runDbUpdate, setupDbUpdateFixture } from './utils/db-update-test-helpers';

const fixtureSubdir = 'db-init';

withTempDir(({ createTempDir }) => {
  describe('db update command (e2e) - errors', () => {
    let cleanupMocks: () => void;

    // `db init` and the emit steps still run on the commander shell, whose
    // output goes to the console this keeps out of the test log.
    beforeEach(() => {
      cleanupMocks = setupCommandMocks().cleanup;
    });

    afterEach(() => {
      cleanupMocks();
    });

    it(
      'succeeds on a fresh database without prior db init',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup, configPath } = await setupDbUpdateFixture(
            connectionString,
            createTempDir,
            fixtureSubdir,
          );

          // db update should work on a fresh database without db init
          const plan = await runDbUpdate(testSetup, ['--config', configPath, '--dry-run']);
          expect(stripAnsi(plan.stderr)).toContain('Planned');
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'handles divergent database with extra column by planning destructive drop',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup, configPath } = await setupDbUpdateFixture(
            connectionString,
            createTempDir,
            fixtureSubdir,
          );

          // Init the database with the contract
          await runDbInit(testSetup, ['--config', configPath, '--no-color']);

          // Manually add an extra column not in the contract (simulate drift)
          await withClient(connectionString, async (client) => {
            await client.query('ALTER TABLE "public"."user" ADD COLUMN "legacy_notes" text');
          });

          // db update should detect the extra column and plan a destructive drop
          const plan = await runDbUpdate(testSetup, ['--config', configPath, '--dry-run']);
          const planOutput = stripAnsi(plan.stderr);
          expect(planOutput).toContain('legacy_notes');
          expect(planOutput).toContain('destructive');
        });
      },
      timeouts.spinUpPpgDev,
    );
  });
});
