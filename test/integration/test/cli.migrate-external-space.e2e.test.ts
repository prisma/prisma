/**
 * `migrate` with an all-external contract space (the Supabase shape):
 * the space pins a head ref but ships zero migration packages, so there
 * is nothing to author and nothing to replay — migrate must advance the
 * space's marker to its head declaratively (mirroring the db-init
 * aggregate planner) instead of demanding an authored graph.
 *
 * The first journey also locks AC8 of TML-3059 (contract-snapshot-store
 * dedup): the seed phase (run as part of `migration plan`) populates
 * `migrations/snapshots/<hex>/contract.json` for the external space's
 * head hash instead of a per-space `migrations/<space-id>/contract.json`
 * sibling, and the subsequent `migrate` — which must resolve the head
 * contract to verify/advance the marker — only succeeds by reading it
 * back through that same store entry (the aggregate loader has no other
 * source for an extension space's contract under the new layout).
 *
 * Also locks the remediation contract for the case that legitimately
 * remains unreachable (an APP space that was never planned): the error's
 * `fix` must prescribe commands that run verbatim — the test executes
 * them and expects migrate to succeed afterwards.
 */

import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createContractEmitCommand } from '@internal/cli/commands/contract-emit';
import type { MigrateResult } from '@internal/cli/commands/migrate';
import { createMigrateCommand } from '@internal/cli/commands/migrate';
import { createMigrationPlanCommand } from '@internal/cli/commands/migration-plan';
import { storageHashHex } from '@internal/framework-components/control';
import { timeouts, withClient, withDevDatabase } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  TEST_EXTERNAL_HEAD_HASH,
  TEST_EXTERNAL_SPACE_ID,
} from './contract-space-fixture/external-space';
import {
  appendImplicitMigrationPlanFrom,
  executeCommand,
  getExitCode,
  parseJsonObjectFromCliCapture,
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';

const execFileAsync = promisify(execFile);
const TSX_BIN = resolve(__dirname, '../../../node_modules/.bin/tsx');
const workspaceRoot = resolve(__dirname, '../../..');

async function inDir<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.cwd();
  try {
    process.chdir(dir);
    return await fn();
  } finally {
    process.chdir(prev);
  }
}

async function emitContract(testDir: string, configPath: string): Promise<void> {
  const command = createContractEmitCommand();
  await inDir(testDir, () => executeCommand(command, ['--config', configPath, '--no-color']));
}

function getLatestMigrationDir(testDir: string): string | undefined {
  const migrationsDir = join(testDir, 'migrations', 'app');
  const dirs = readdirSync(migrationsDir).filter((d) => {
    if (d.startsWith('.')) return false;
    if (d === 'refs') return false;
    return statSync(join(migrationsDir, d)).isDirectory();
  });
  if (dirs.length === 0) return undefined;
  let newest = dirs[0]!;
  let newestMtime = statSync(join(migrationsDir, newest)).mtimeMs;
  for (let i = 1; i < dirs.length; i++) {
    const dir = dirs[i]!;
    const mtime = statSync(join(migrationsDir, dir)).mtimeMs;
    if (mtime > newestMtime) {
      newestMtime = mtime;
      newest = dir;
    }
  }
  return newest;
}

async function selfEmitLatestMigration(testDir: string): Promise<void> {
  const latest = getLatestMigrationDir(testDir);
  if (!latest) return;
  const migrationTs = join(testDir, 'migrations', 'app', latest, 'migration.ts');
  await execFileAsync(TSX_BIN, [migrationTs], { cwd: testDir });
}

async function runMigrationPlan(testDir: string, args: readonly string[]): Promise<number> {
  const command = createMigrationPlanCommand();
  const planArgs = appendImplicitMigrationPlanFrom(testDir, args);
  const exit = await inDir(testDir, () => executeCommand(command, [...planArgs]));
  if (exit === 0) {
    await selfEmitLatestMigration(testDir);
  }
  return exit;
}

async function runMigrate(testDir: string, args: readonly string[]): Promise<number> {
  const command = createMigrateCommand();
  return inDir(testDir, () => executeCommand(command, [...args]));
}

async function runMigrateAllowFailure(testDir: string, args: readonly string[]): Promise<number> {
  try {
    return await runMigrate(testDir, args);
  } catch {
    return getExitCode() ?? 1;
  }
}

withTempDir(({ createTempDir }) => {
  describe('migrate with an all-external contract space (e2e)', () => {
    let consoleOutput: string[];
    let cleanupMocks: () => void;

    beforeEach(() => {
      process.chdir(workspaceRoot);
      const mocks = setupCommandMocks();
      consoleOutput = mocks.consoleOutput;
      cleanupMocks = mocks.cleanup;
    });

    afterEach(() => {
      process.chdir(workspaceRoot);
      cleanupMocks();
    });

    it(
      'a fresh database migrates: app ops apply and the external space marker advances to its head',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = setupTestDirectoryFromFixtures(
            createTempDir,
            'migrate-external-space',
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );

          await emitContract(testDir, configPath);
          // Seeds the external space's pinned artifacts (head ref, no
          // bundles) and authors the app baseline bundle.
          await runMigrationPlan(testDir, [
            '--config',
            configPath,
            '--name',
            'initial',
            '--no-color',
          ]);

          // AC8: the seed phase populates the content-addressed store for
          // the external space's head, not a per-space sibling copy.
          const storeContractPath = join(
            testDir,
            'migrations',
            'snapshots',
            storageHashHex(TEST_EXTERNAL_HEAD_HASH),
            'contract.json',
          );
          expect(existsSync(storeContractPath)).toBe(true);
          const storedContract = JSON.parse(readFileSync(storeContractPath, 'utf-8')) as {
            storage: { storageHash: string };
          };
          expect(storedContract.storage.storageHash).toBe(TEST_EXTERNAL_HEAD_HASH);
          expect(
            existsSync(join(testDir, 'migrations', TEST_EXTERNAL_SPACE_ID, 'contract.json')),
          ).toBe(false);

          // The aggregate loader must resolve the external space's head
          // contract through that same store entry: `migrate` verifies
          // and advances the marker against it below, with no other
          // contract source available under the new layout.
          consoleOutput.length = 0;
          await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);

          const parsed = parseJsonObjectFromCliCapture(consoleOutput) as MigrateResult;
          expect(parsed.ok).toBe(true);

          // The external space's marker advanced to its head ref with zero DDL.
          await withClient(connectionString, async (client) => {
            const result = await client.query(
              'SELECT core_hash FROM prisma_contract.marker WHERE space = $1',
              [TEST_EXTERNAL_SPACE_ID],
            );
            expect(result.rows.length).toBe(1);
            expect(result.rows[0]?.core_hash).toBe(TEST_EXTERNAL_HEAD_HASH);
          });

          // Idempotency: a second run reports up to date and succeeds.
          consoleOutput.length = 0;
          await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);
          const second = parseJsonObjectFromCliCapture(consoleOutput) as MigrateResult & {
            summary?: string;
          };
          expect(second.ok).toBe(true);
          expect(second.summary).toContain('Already up to date');
        });
      },
      timeouts.spinUpPpgDev * 2,
    );

    it(
      'a never-planned APP space still errors, and the printed remediation runs verbatim',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = setupTestDirectoryFromFixtures(
            createTempDir,
            'migration-apply',
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );

          await emitContract(testDir, configPath);
          // No `migration plan` — the app space has no on-disk graph.

          consoleOutput.length = 0;
          const exit = await runMigrateAllowFailure(testDir, [
            '--config',
            configPath,
            '--json',
            '--no-color',
          ]);
          expect(exit).not.toBe(0);

          const errorJson = parseJsonObjectFromCliCapture(consoleOutput) as {
            summary?: string;
            fix?: string;
            meta?: { kind?: string; spaceId?: string };
          };
          expect(errorJson.meta?.kind).toBe('neverPlanned');
          expect(errorJson.meta?.spaceId).toBe('app');

          // The remediation must not prescribe a hash the planner cannot
          // resolve (an empty graph has no nodes to resolve hashes against),
          // and its two numbered steps must be exactly the plan-then-apply
          // commands asserted here — if the printed text drifts, this
          // parse-and-execute round fails rather than silently running
          // hard-coded commands.
          const fix = errorJson.fix ?? '';
          expect(fix).not.toMatch(/--to [0-9a-f]{64}/);
          const numberedCommands = fix
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => /^\d+\.\s/.test(line))
            .map((line) => line.replace(/^\d+\.\s+/, ''));
          expect(numberedCommands).toEqual([
            'prisma-next migration plan --name <slug>',
            'prisma-next migrate',
          ]);

          // Execute the printed remediation: derive each command's argv from
          // the fix text itself, substituting the <slug> placeholder (plus
          // the harness plumbing every invocation needs: --config/--json).
          const [planCommand, migrateCommand] = numberedCommands;
          const planArgs = (planCommand ?? '')
            .replace(/^prisma-next migration plan\s*/, '')
            .replaceAll('<slug>', 'initial')
            .split(/\s+/)
            .filter((arg) => arg.length > 0);
          const planExit = await runMigrationPlan(testDir, [
            ...planArgs,
            '--config',
            configPath,
            '--no-color',
          ]);
          expect(planExit).toBe(0);

          const migrateArgs = (migrateCommand ?? '')
            .replace(/^prisma-next migrate\s*/, '')
            .split(/\s+/)
            .filter((arg) => arg.length > 0);
          consoleOutput.length = 0;
          await runMigrate(testDir, [
            ...migrateArgs,
            '--config',
            configPath,
            '--json',
            '--no-color',
          ]);
          const parsed = parseJsonObjectFromCliCapture(consoleOutput) as MigrateResult;
          expect(parsed.ok).toBe(true);
        });
      },
      timeouts.spinUpPpgDev * 2,
    );
  });
});
