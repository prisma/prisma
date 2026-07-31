import { execFile } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createContractEmitCommand } from '@internal/cli/commands/contract-emit';
import type { MigrateResult } from '@internal/cli/commands/migrate';
import { createMigrateCommand } from '@internal/cli/commands/migrate';
import { createMigrationPlanCommand } from '@internal/cli/commands/migration-plan';
import { readMigrationsDir } from '@internal/migration-tools/io';
import { timeouts, withClient, withDevDatabase } from '@repo/test-utils';
import stripAnsi from 'strip-ansi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const TSX_BIN = resolve(__dirname, '../../../node_modules/.bin/tsx');

import {
  appendImplicitMigrationPlanFrom,
  executeCommand,
  getExitCode,
  parseJsonObjectFromCliCapture,
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';
import { replaceInFileOrThrow } from './utils/contract-fixture-editing';

const fixtureSubdir = 'migration-apply';
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

async function runMigrationPlan(testDir: string, args: readonly string[]): Promise<number> {
  const command = createMigrationPlanCommand();
  const planArgs = appendImplicitMigrationPlanFrom(testDir, args);
  const exit = await inDir(testDir, () => executeCommand(command, [...planArgs]));
  if (exit === 0) {
    // Self-emit the freshly planned draft migration so `migration apply` will
    // accept it. Mirrors the prior `migration emit` step that `runMigrationPlan`
    // used to trigger before self-emit became the contract.
    await selfEmitLatestMigration(testDir);
  }
  return exit;
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

async function runMigrate(testDir: string, args: readonly string[]): Promise<number> {
  const command = createMigrateCommand();
  return inDir(testDir, () => executeCommand(command, [...args]));
}

withTempDir(({ createTempDir }) => {
  describe('migrate command (e2e)', () => {
    let consoleOutput: string[];
    let consoleErrors: string[];
    let cleanupMocks: () => void;

    beforeEach(() => {
      process.chdir(workspaceRoot);
      const mocks = setupCommandMocks();
      consoleOutput = mocks.consoleOutput;
      consoleErrors = mocks.consoleErrors;
      cleanupMocks = mocks.cleanup;
    });

    afterEach(() => {
      process.chdir(workspaceRoot);
      cleanupMocks();
    });

    describe('plan then apply (happy path)', () => {
      it(
        'applies a single migration to an empty database',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            const { testDir, configPath: baseConfigPath } = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );
            const configPath = baseConfigPath;

            await emitContract(testDir, configPath);

            consoleOutput.length = 0;
            await runMigrationPlan(testDir, [
              '--config',
              configPath,
              '--name',
              'initial',
              '--no-color',
            ]);

            consoleOutput.length = 0;
            consoleErrors.length = 0;
            await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);

            const parsed = parseJsonObjectFromCliCapture(consoleOutput) as MigrateResult;

            expect(parsed.ok).toBe(true);
            expect(parsed.migrationsApplied).toBe(1);
            expect(parsed.applied).toHaveLength(1);
            expect(parsed.applied[0]!.operationsExecuted).toBeGreaterThan(0);

            // Verify table was created
            await withClient(connectionString, async (client) => {
              const result = await client.query(`
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'user'
              `);
              expect(result.rows.length).toBe(1);
            });

            // Verify marker was written
            await withClient(connectionString, async (client) => {
              const result = await client.query(
                'SELECT core_hash FROM prisma_contract.marker WHERE space = $1',
                ['app'],
              );
              expect(result.rows.length).toBe(1);
              expect(result.rows[0]?.core_hash).toBe(parsed.markerHash);
            });
          });
        },
        timeouts.spinUpPpgDev,
      );
    });

    describe('idempotency', () => {
      it(
        're-run after success is a no-op',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            const { testDir, configPath } = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );

            await emitContract(testDir, configPath);
            await runMigrationPlan(testDir, [
              '--config',
              configPath,
              '--name',
              'initial',
              '--no-color',
            ]);

            // First apply
            consoleOutput.length = 0;
            await runMigrate(testDir, ['--config', configPath, '--no-color']);

            // Second apply — should be no-op
            consoleOutput.length = 0;
            await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);

            const parsed = parseJsonObjectFromCliCapture(consoleOutput) as MigrateResult;

            expect(parsed.ok).toBe(true);
            expect(parsed.migrationsApplied).toBe(0);
            expect(parsed.summary).toBe('Already up to date');
          });
        },
        timeouts.spinUpPpgDev,
      );
    });

    describe('destination contract targeting', () => {
      it(
        'fails when current contract has no planned migration path',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            const { testDir, configPath, contractPath } = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );

            await emitContract(testDir, configPath);
            await runMigrationPlan(testDir, [
              '--config',
              configPath,
              '--name',
              'initial',
              '--no-color',
            ]);
            await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);

            // Change contract and re-emit without planning a new migration.
            replaceInFileOrThrow(
              contractPath!,
              '        email: field.column(textColumn),\n',
              '        email: field.column(textColumn),\n        nickname: field.column(textColumn).optional(),\n',
            );
            await emitContract(testDir, configPath);

            consoleOutput.length = 0;
            consoleErrors.length = 0;
            let failed = false;
            try {
              await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);
            } catch {
              failed = true;
            }

            expect(failed).toBe(true);
            expect(getExitCode()).toBe(2);
            // In --json mode, error output goes to stdout via ui.output(), not stderr.
            // consoleOutput contains both stdout and stderr; check the combined output.
            const output = stripAnsi(consoleOutput.join('\n'));
            expect(output).toContain('Current contract has no planned migration path');
          });
        },
        timeouts.spinUpPpgDev,
      );
    });

    describe('multiple migrations', () => {
      it(
        'applies multiple migrations in DAG order',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            const { testDir, configPath, contractPath } = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );

            // First migration: create user table
            await emitContract(testDir, configPath);
            consoleOutput.length = 0;
            await runMigrationPlan(testDir, [
              '--config',
              configPath,
              '--name',
              'add_user',
              '--no-color',
            ]);

            // Modify contract: add a column
            replaceInFileOrThrow(
              contractPath!,
              '        email: field.column(textColumn),\n',
              '        email: field.column(textColumn),\n        name: field.column(textColumn).optional(),\n',
            );

            // Second migration: add name column
            consoleOutput.length = 0;
            await emitContract(testDir, configPath);
            consoleOutput.length = 0;
            await runMigrationPlan(testDir, [
              '--config',
              configPath,
              '--name',
              'add_name',
              '--no-color',
            ]);

            // Apply all migrations at once
            consoleOutput.length = 0;
            await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);

            const parsed = parseJsonObjectFromCliCapture(consoleOutput) as MigrateResult;

            expect(parsed.ok).toBe(true);
            expect(parsed.migrationsApplied).toBe(2);
            expect(parsed.applied).toHaveLength(2);

            // Verify both table and column exist
            await withClient(connectionString, async (client) => {
              const result = await client.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'user'
                ORDER BY ordinal_position
              `);
              const columns = result.rows.map((r: Record<string, unknown>) => r['column_name']);
              expect(columns).toContain('id');
              expect(columns).toContain('email');
              expect(columns).toContain('name');
            });
          });
        },
        timeouts.spinUpPpgDev,
      );
    });

    describe('resume after partial apply', () => {
      it(
        'resumes from last successful migration after failure',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            const { testDir, configPath, contractPath } = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );

            // Create two migrations
            await emitContract(testDir, configPath);
            await runMigrationPlan(testDir, [
              '--config',
              configPath,
              '--name',
              'initial',
              '--no-color',
            ]);

            // Apply first migration successfully.
            consoleOutput.length = 0;
            await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);
            const firstApply = parseJsonObjectFromCliCapture(consoleOutput) as MigrateResult;
            expect(firstApply.migrationsApplied).toBe(1);

            // Insert rows with duplicate emails so a unique constraint will fail.
            await withClient(connectionString, async (client) => {
              await client.query(
                `INSERT INTO "user" (id, email) VALUES (1, 'dup@example.com'), (2, 'dup@example.com')`,
              );
            });

            // Plan second migration that adds a unique constraint on email.
            replaceInFileOrThrow(
              contractPath!,
              '        email: field.column(textColumn),\n',
              `        email: field.column(textColumn).unique({ name: 'user_email_key' }),\n`,
            );

            await emitContract(testDir, configPath);
            await runMigrationPlan(testDir, [
              '--config',
              configPath,
              '--name',
              'add_unique_email',
              '--no-color',
            ]);

            // Apply fails: duplicate emails violate the unique constraint.
            consoleOutput.length = 0;
            let failed = false;
            try {
              await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);
            } catch {
              failed = true;
            }
            expect(failed).toBe(true);
            expect(getExitCode()).toBe(2);

            // Marker must remain at the first migration hash (resume point).
            const migrationsRoot = join(testDir, 'migrations');
            const { packages } = await readMigrationsDir(join(migrationsRoot, 'app'), {
              migrationsDir: migrationsRoot,
            });
            const firstMigration = packages.find((p) => p.metadata.from === null);
            const secondMigration = packages.find(
              (p) => p.metadata.to !== firstMigration?.metadata.to,
            );
            expect(firstMigration).toBeDefined();
            expect(secondMigration).toBeDefined();

            await withClient(connectionString, async (client) => {
              const marker = await client.query(
                'SELECT core_hash FROM prisma_contract.marker WHERE space = $1',
                ['app'],
              );
              expect(marker.rows[0]?.core_hash).toBe(firstMigration!.metadata.to);
            });

            // Fix: deduplicate emails, then re-run apply; it should resume from marker.
            await withClient(connectionString, async (client) => {
              await client.query(`UPDATE "user" SET email = 'unique@example.com' WHERE id = 2`);
            });

            consoleOutput.length = 0;
            await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);
            const resumeResult = parseJsonObjectFromCliCapture(consoleOutput) as MigrateResult;
            expect(resumeResult.migrationsApplied).toBe(1);
            expect(resumeResult.markerHash).toBe(secondMigration!.metadata.to);
          });
        },
        timeouts.spinUpPpgDev,
      );
    });

    describe('styled output', () => {
      it(
        'produces human-readable output on apply',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            const { testDir, configPath } = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );

            await emitContract(testDir, configPath);
            await runMigrationPlan(testDir, [
              '--config',
              configPath,
              '--name',
              'initial',
              '--no-color',
            ]);

            consoleOutput.length = 0;
            await runMigrate(testDir, ['--config', configPath, '--no-color']);

            const output = stripAnsi(consoleOutput.join('\n'));
            expect(output).toContain('Applied');
            expect(output).toContain('migration(s)');
            expect(output).toContain('marker:');
          });
        },
        timeouts.spinUpPpgDev,
      );
    });

    describe('destructive changes', () => {
      it(
        'applies a migration that drops a column',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            const { testDir, configPath, contractPath } = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );

            // Plan and apply the initial migration (creates user table with id + email)
            await emitContract(testDir, configPath);
            await runMigrationPlan(testDir, [
              '--config',
              configPath,
              '--name',
              'initial',
              '--no-color',
            ]);
            consoleOutput.length = 0;
            await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);

            const firstApply = parseJsonObjectFromCliCapture(consoleOutput) as MigrateResult;
            expect(firstApply.ok).toBe(true);
            expect(firstApply.migrationsApplied).toBe(1);

            // Verify email column exists
            await withClient(connectionString, async (client) => {
              const result = await client.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'email'
              `);
              expect(result.rows.length).toBe(1);
            });

            // Remove the email column from the contract
            replaceInFileOrThrow(contractPath!, '        email: field.column(textColumn),\n', '');

            // Re-emit and plan the destructive migration
            await emitContract(testDir, configPath);
            consoleOutput.length = 0;
            await runMigrationPlan(testDir, [
              '--config',
              configPath,
              '--name',
              'drop_email',
              '--no-color',
            ]);

            // Apply the destructive migration
            consoleOutput.length = 0;
            consoleErrors.length = 0;
            await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);

            const secondApply = parseJsonObjectFromCliCapture(consoleOutput) as MigrateResult;
            expect(secondApply.ok).toBe(true);
            expect(secondApply.migrationsApplied).toBe(1);

            // Verify email column no longer exists
            await withClient(connectionString, async (client) => {
              const result = await client.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'email'
              `);
              expect(result.rows.length).toBe(0);
            });

            // Verify marker was updated
            await withClient(connectionString, async (client) => {
              const result = await client.query(
                'SELECT core_hash FROM prisma_contract.marker WHERE space = $1',
                ['app'],
              );
              expect(result.rows.length).toBe(1);
              expect(result.rows[0]?.core_hash).toBe(secondApply.markerHash);
            });
          });
        },
        timeouts.spinUpPpgDev,
      );

      it(
        'applies multiple migrations including destructive in DAG order',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            const { testDir, configPath, contractPath } = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );

            // Plan initial migration
            await emitContract(testDir, configPath);
            await runMigrationPlan(testDir, [
              '--config',
              configPath,
              '--name',
              'initial',
              '--no-color',
            ]);

            // Add a column, then remove email — two sequential changes
            replaceInFileOrThrow(
              contractPath!,
              '        email: field.column(textColumn),\n',
              '        email: field.column(textColumn),\n        name: field.column(textColumn).optional(),\n',
            );
            await emitContract(testDir, configPath);
            await runMigrationPlan(testDir, [
              '--config',
              configPath,
              '--name',
              'add_name',
              '--no-color',
            ]);

            replaceInFileOrThrow(contractPath!, '        email: field.column(textColumn),\n', '');
            await emitContract(testDir, configPath);
            await runMigrationPlan(testDir, [
              '--config',
              configPath,
              '--name',
              'drop_email',
              '--no-color',
            ]);

            // Apply all three migrations at once against fresh DB
            consoleOutput.length = 0;
            await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);

            const result = parseJsonObjectFromCliCapture(consoleOutput) as MigrateResult;
            expect(result.ok).toBe(true);
            expect(result.migrationsApplied).toBe(3);

            // Verify final state: user table has id + name, no email
            await withClient(connectionString, async (client) => {
              const cols = await client.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'user'
                ORDER BY ordinal_position
              `);
              const columnNames = cols.rows.map((r: Record<string, unknown>) => r['column_name']);
              expect(columnNames).toContain('id');
              expect(columnNames).toContain('name');
              expect(columnNames).not.toContain('email');
            });
          });
        },
        timeouts.spinUpPpgDev,
      );
    });
  });
});
