import { timeouts, withClient, withDevDatabase } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  parseJsonObjectFromCliCapture,
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';
import { runDbInit, setupDbInitFixture } from './utils/db-init-test-helpers';

/**
 * Integration coverage for the marker-aware contract-space verifier wired
 * into `db init`. Locks two `db init`-level rejection cases:
 *
 * - `db init` rejects when an orphan marker row exists in the database
 *   (a marker for a space that is not declared in `extensions`).
 * - `db init` rejects when an extension is declared in `extensions`
 *   but no pinned `migrations/<space-id>/` directory exists on disk yet
 *   (`declaredButUnmigrated`).
 *
 * Mirrors the marker / pinned-dir setup patterns from
 * `packages/1-framework/3-tooling/cli/test/utils/contract-space-verifier-marker-check.test.ts`
 * but at the integration layer — driving a real `db init` against a
 * real Postgres database — so a regression in the wiring (e.g. the
 * verifier silently dropped from `db init`) cannot pass tests.
 */
withTempDir(({ createTempDir }) => {
  describe('db init command - contract-space verifier wiring', () => {
    let consoleOutput: string[] = [];
    let cleanupMocks: () => void;

    beforeEach(() => {
      const mocks = setupCommandMocks();
      consoleOutput = mocks.consoleOutput;
      cleanupMocks = mocks.cleanup;
    });

    afterEach(() => {
      cleanupMocks();
    });

    it(
      'rejects when an orphan marker row exists for a space not in extensions (AC-13)',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          await withClient(connectionString, async (client) => {
            await client.query('CREATE SCHEMA IF NOT EXISTS prisma_contract');
            await client.query(`
              CREATE TABLE IF NOT EXISTS prisma_contract.marker (
                space TEXT NOT NULL PRIMARY KEY DEFAULT 'app',
                core_hash TEXT NOT NULL,
                profile_hash TEXT NOT NULL,
                contract_json JSONB,
                canonical_version INTEGER,
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                app_tag TEXT,
                meta JSONB DEFAULT '{}',
                invariants TEXT[] NOT NULL DEFAULT '{}'
              )
            `);
            await client.query(`
              INSERT INTO prisma_contract.marker (space, core_hash, profile_hash, contract_json)
              VALUES ('retired-extension', 'retired', 'retired-profile', '{}')
              ON CONFLICT (space) DO NOTHING
            `);
          });

          const { testSetup, configPath } = await setupDbInitFixture(
            connectionString,
            createTempDir,
            'db-init',
          );

          consoleOutput.length = 0;

          await expect(
            runDbInit(testSetup, ['--config', configPath, '--json', '--no-color']),
          ).rejects.toThrow();

          const errorJson = parseJsonObjectFromCliCapture(consoleOutput) as Record<string, unknown>;

          expect(errorJson).toMatchObject({
            code: 'MIGRATION.CONTRACT_SPACE_VIOLATION',
          });
          const meta = errorJson['meta'] as
            | { violations?: Array<{ kind: string; spaceId: string }> }
            | undefined;
          const kinds = (meta?.violations ?? []).map((v) => v.kind);
          const spaces = (meta?.violations ?? []).map((v) => v.spaceId);
          expect(kinds).toContain('orphanMarker');
          expect(spaces).toContain('retired-extension');
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'rejects when an extension declares a contractSpace but no pinned migrations dir exists (AC-16)',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            'db-init-with-contract-space',
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const { configPath } = testSetup;

          // Emit contract — needed because the runner reads contract.json.
          // No `migrations/<space-id>/` dir is written, so the verifier
          // surfaces `declaredButUnmigrated` for the test extension.
          const { createContractEmitCommand } = await import(
            '@internal/cli/commands/contract-emit'
          );
          const { executeCommand } = await import('./utils/cli-test-helpers');
          const emitCommand = createContractEmitCommand();
          const originalCwd = process.cwd();
          try {
            process.chdir(testSetup.testDir);
            await executeCommand(emitCommand, ['--config', configPath, '--no-color']);
          } finally {
            process.chdir(originalCwd);
          }

          consoleOutput.length = 0;

          await expect(
            runDbInit(testSetup, ['--config', configPath, '--json', '--no-color']),
          ).rejects.toThrow();

          const errorJson = parseJsonObjectFromCliCapture(consoleOutput) as Record<string, unknown>;

          expect(String(errorJson['code'])).toMatch(/^MIGRATION\.CONTRACT_SPACE/);
          const meta = errorJson['meta'] as
            | { violations?: Array<{ kind: string; spaceId: string }> }
            | undefined;
          const kinds = (meta?.violations ?? []).map((v) => v.kind);
          const spaces = (meta?.violations ?? []).map((v) => v.spaceId);
          expect(kinds).toContain('declaredButUnmigrated');
          expect(spaces).toContain('test-contract-space');
        });
      },
      timeouts.spinUpPpgDev,
    );
  });
});
