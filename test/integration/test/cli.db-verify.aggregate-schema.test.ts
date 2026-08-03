import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createContractEmitCommand } from '@internal/cli/commands/contract-emit';
import { createDbVerifyCommand } from '@internal/cli/commands/db-verify';
import type { Contract } from '@internal/contract/types';
import { APP_SPACE_ID } from '@internal/framework-components/control';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { materialiseMigrationPackage } from '@internal/migration-tools/io';
import { emitContractSpaceArtifacts } from '@internal/migration-tools/spaces';
import type { SqlStorage } from '@internal/sql-contract/types';
import { seedTestMarker } from '@internal/sql-runtime/test/utils';
import { timeouts, withClient, withDevDatabase } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import testContractSpaceExtension from './contract-space-fixture/control';
import { bootstrapPostgresSignMarkerTables } from './postgres-bootstrap';
import {
  executeCommand,
  getExitCode,
  loadContractFromDisk,
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';

/**
 * F23 lock — `db verify` against a multi-member aggregate (app +
 * extension, both claiming live tables) returns zero schema issues.
 *
 * Pre-aggregate (M2 R6 R1), `db verify` projected the live schema only
 * through the app contract. Tables claimed by extensions surfaced as
 * `extras` and tripped lenient/strict schema diffs, polluting the
 * verify output. The aggregate verifier (M2.5) pre-projects the live
 * schema per member before running the family's schema-verify, so each
 * member only sees the elements it owns.
 *
 * Setup mirrors the spec's intent (sub-spec § "Commit 6"):
 * - app contract claims `user`
 * - extension `test-contract-space` claims `test_box`
 * - both tables exist in the live DB and both markers match the
 *   pinned contracts
 *
 * Expected: `db verify` exits 0 with `ok: true` and zero schema issues.
 */

const EXT = testContractSpaceExtension;
const extContractJson = EXT.contractSpace!.contractJson;
const extHeadRef = EXT.contractSpace!.headRef;
const extMigrations = EXT.contractSpace!.migrations;
const EXT_SPACE_ID = EXT.id;

async function writePinnedExtensionDir(testDir: string): Promise<string> {
  const migrationsDir = join(testDir, 'migrations');
  await mkdir(migrationsDir, { recursive: true });

  // The on-disk head ref's `invariants` and the migration package's
  // `providedInvariants` must both round-trip through
  // `deriveProvidedInvariants` (M2.5b loader integrity gate, error
  // MIGRATION.CONTRACT_SPACE_VIOLATION). The test extension's baseline op carries an
  // `invariantId`, so the derivation produces `[TEST_BASELINE_INVARIANT_ID]`
  // — match that on disk for both the head ref and migration metadata.
  await emitContractSpaceArtifacts(migrationsDir, EXT_SPACE_ID, {
    contract: extContractJson,
    contractDts: '// placeholder for test\nexport {};\n',
    headRef: { hash: extHeadRef.hash, invariants: [...extHeadRef.invariants] },
  });

  const spaceDir = join(migrationsDir, EXT_SPACE_ID);
  for (const pkg of extMigrations) {
    const ops = [...pkg.ops];
    // Recompute the hash because the synthetic placeholder hash on the
    // in-memory fixture's metadata won't satisfy the loader's hash gate.
    const migrationHash = computeMigrationHash(pkg.metadata, ops);
    await materialiseMigrationPackage(spaceDir, {
      dirName: pkg.dirName,
      metadata: { ...pkg.metadata, migrationHash },
      ops,
    });
  }

  return migrationsDir;
}

withTempDir(({ createTempDir }) => {
  describe('db verify command - aggregate schema verification (F23)', () => {
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
      'returns zero schema issues when app and extension both claim live tables',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            'db-init-with-contract-space',
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const { testDir, configPath } = testSetup;

          // Pre-emit pinned migrations for the test extension so the
          // aggregate loader's layout / integrity checks pass.
          await writePinnedExtensionDir(testDir);

          // Emit the app contract so `db verify` has a contract.json to
          // compare against. The fixture's `contract.output` points at
          // `src/prisma/contract.json`.
          const emitCommand = createContractEmitCommand();
          const originalCwd = process.cwd();
          try {
            process.chdir(testDir);
            await executeCommand(emitCommand, ['--config', configPath, '--no-color']);
          } finally {
            process.chdir(originalCwd);
          }

          const appContractPath = join(testDir, 'src/prisma/contract.json');
          const appContract = loadContractFromDisk<Contract<SqlStorage>>(appContractPath);

          // Live DB: create both tables and both markers.
          await withClient(connectionString, async (client) => {
            await client.query(`
              CREATE TABLE IF NOT EXISTS "user" (
                id integer NOT NULL,
                email text NOT NULL,
                PRIMARY KEY (id)
              )
            `);
            await client.query(`
              CREATE TABLE IF NOT EXISTS test_box (
                x integer NOT NULL,
                y integer NOT NULL
              )
            `);

            await bootstrapPostgresSignMarkerTables(client);

            await seedTestMarker(client, {
              space: APP_SPACE_ID,
              storageHash: appContract.storage.storageHash,
              profileHash: appContract.profileHash ?? appContract.storage.storageHash,
              contractJson: appContract,
              canonicalVersion: 1,
            });

            await seedTestMarker(client, {
              space: EXT_SPACE_ID,
              storageHash: extContractJson.storage.storageHash,
              profileHash: extContractJson.profileHash ?? extContractJson.storage.storageHash,
              contractJson: extContractJson,
              canonicalVersion: 1,
              invariants: [...extHeadRef.invariants],
            });
          });

          consoleOutput.length = 0;

          const command = createDbVerifyCommand();
          const verifyCwd = process.cwd();
          try {
            process.chdir(testDir);
            await executeCommand(command, ['--config', configPath, '--json', '--no-color']);
          } finally {
            process.chdir(verifyCwd);
          }

          expect(getExitCode()).toBe(0);

          const joined = consoleOutput.join('\n');
          const start = joined.indexOf('{');
          const end = joined.lastIndexOf('}');
          expect(start).toBeGreaterThanOrEqual(0);
          const parsed = JSON.parse(joined.slice(start, end + 1)) as Record<string, unknown>;

          expect(parsed).toMatchObject({
            ok: true,
            mode: 'full',
          });
          const schema = parsed['schema'] as { summary?: string } | undefined;
          expect(schema?.summary).toBe('Database schema satisfies contract');
        });
      },
      timeouts.spinUpPpgDev,
    );
  });
});
