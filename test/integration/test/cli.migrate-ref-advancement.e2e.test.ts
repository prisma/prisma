import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createContractEmitCommand } from '@internal/cli/commands/contract-emit';
import type { MigrateResult } from '@internal/cli/commands/migrate';
import { createMigrateCommand } from '@internal/cli/commands/migrate';
import { createMigrationPlanCommand } from '@internal/cli/commands/migration-plan';
import { contractSnapshotDir } from '@internal/migration-tools/contract-snapshot-store';
import { timeouts, withDevDatabase } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

const execFileAsync = promisify(execFile);
const TSX_BIN = resolve(__dirname, '../../../node_modules/.bin/tsx');
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

function appRefsDir(testDir: string): string {
  return join(testDir, 'migrations/app/refs');
}

function refPointerPath(refsDir: string, name: string): string {
  return join(refsDir, `${name}.json`);
}

function migrationsDirFromRefsDir(refsDir: string): string {
  return dirname(dirname(refsDir));
}

function refPointerHash(refsDir: string, name: string): string | undefined {
  const pointerPath = refPointerPath(refsDir, name);
  if (!existsSync(pointerPath)) return undefined;
  return (JSON.parse(readFileSync(pointerPath, 'utf-8')) as { hash: string }).hash;
}

function storeContractJsonPath(refsDir: string, name: string): string {
  const hash = refPointerHash(refsDir, name);
  if (hash === undefined) throw new Error(`ref "${name}" has no pointer`);
  return join(contractSnapshotDir(migrationsDirFromRefsDir(refsDir), hash), 'contract.json');
}

// A ref now consists of just its pointer file; the contract bytes resolve
// through the content-addressed store keyed by the pointer's hash.
function refFilesExist(refsDir: string, name: string): boolean {
  const hash = refPointerHash(refsDir, name);
  if (hash === undefined) return false;
  const storeDir = contractSnapshotDir(migrationsDirFromRefsDir(refsDir), hash);
  return existsSync(join(storeDir, 'contract.json')) && existsSync(join(storeDir, 'contract.d.ts'));
}

function refFilesAbsent(refsDir: string, name: string): boolean {
  return !existsSync(refPointerPath(refsDir, name));
}

function noRefFilesUnder(refsDir: string): boolean {
  if (!existsSync(refsDir)) return true;
  return readdirSync(refsDir).length === 0;
}

async function seedPlannedMigration(
  createTempDir: () => string,
  connectionString: string,
): Promise<{
  testDir: string;
  configPath: string;
  migrationDir: string;
  toHash: string;
  contractPath?: string;
}> {
  const { testDir, configPath, contractPath } = setupTestDirectoryFromFixtures(
    createTempDir,
    fixtureSubdir,
    'prisma-next.config.with-db.ts',
    { '{{DB_URL}}': connectionString },
  );
  await emitContract(testDir, configPath);
  await runMigrationPlan(testDir, ['--config', configPath, '--name', 'initial', '--no-color']);
  const migrationDir = getLatestMigrationDir(testDir)!;
  const manifest = JSON.parse(
    readFileSync(join(testDir, 'migrations', 'app', migrationDir, 'migration.json'), 'utf-8'),
  ) as { to: string };
  return { testDir, configPath, migrationDir, toHash: manifest.to, contractPath };
}

withTempDir(({ createTempDir }) => {
  describe('migrate ref advancement (e2e)', () => {
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
      'does not advance any ref without --advance-ref',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const refsDir = appRefsDir(testDir);

          await runMigrate(testDir, ['--config', configPath, '--no-color']);

          expect(noRefFilesUnder(refsDir)).toBe(true);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'advances an explicit ref on the default database',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const refsDir = appRefsDir(testDir);

          await runMigrate(testDir, [
            '--config',
            configPath,
            '--advance-ref',
            'staging',
            '--no-color',
          ]);

          expect(refFilesExist(refsDir, 'staging')).toBe(true);
          expect(refFilesAbsent(refsDir, 'db')).toBe(true);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'does not advance any ref with --to when --advance-ref is omitted',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath, migrationDir } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const refsDir = appRefsDir(testDir);

          await runMigrate(testDir, ['--config', configPath, '--no-color']);
          consoleOutput.length = 0;

          await runMigrate(testDir, ['--config', configPath, '--to', migrationDir, '--no-color']);

          expect(noRefFilesUnder(refsDir)).toBe(true);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'advances an explicit ref with --to using the bundle contract snapshot',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath, migrationDir, toHash } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const refsDir = appRefsDir(testDir);
          const bundleEndContract = join(
            contractSnapshotDir(join(testDir, 'migrations'), toHash),
            'contract.json',
          );

          await runMigrate(testDir, ['--config', configPath, '--no-color']);
          consoleOutput.length = 0;

          await runMigrate(testDir, [
            '--config',
            configPath,
            '--to',
            migrationDir,
            '--advance-ref',
            'staging',
            '--no-color',
          ]);

          expect(refFilesExist(refsDir, 'staging')).toBe(true);
          expect(
            JSON.parse(readFileSync(storeContractJsonPath(refsDir, 'staging'), 'utf-8')),
          ).toEqual(JSON.parse(readFileSync(bundleEndContract, 'utf-8')));
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'does not implicitly advance db on the default database',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const refsDir = appRefsDir(testDir);

          await runMigrate(testDir, ['--config', configPath, '--no-color']);

          expect(refFilesAbsent(refsDir, 'db')).toBe(true);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'advances an explicit ref when --db is provided',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const refsDir = appRefsDir(testDir);

          await runMigrate(testDir, [
            '--config',
            configPath,
            '--db',
            connectionString,
            '--advance-ref',
            'staging',
            '--no-color',
          ]);

          expect(refFilesExist(refsDir, 'staging')).toBe(true);
          expect(refFilesAbsent(refsDir, 'db')).toBe(true);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'includes advancedRef in JSON apply output',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const outputStart = consoleOutput.length;

          await runMigrate(testDir, [
            '--config',
            configPath,
            '--advance-ref',
            'staging',
            '--json',
            '--no-color',
          ]);

          const parsed = parseJsonObjectFromCliCapture(consoleOutput.slice(outputStart)) as Record<
            string,
            unknown
          >;
          expect(parsed['advancedRef']).toEqual(
            expect.objectContaining({ name: 'staging', hash: expect.any(String) }),
          );
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'writes ref on no-op apply when --advance-ref is provided',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const refsDir = appRefsDir(testDir);

          await runMigrate(testDir, ['--config', configPath, '--no-color']);
          consoleOutput.length = 0;

          await runMigrate(testDir, [
            '--config',
            configPath,
            '--advance-ref',
            'staging',
            '--json',
            '--no-color',
          ]);

          expect(refFilesExist(refsDir, 'staging')).toBe(true);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'idempotently rewrites the ref on repeated migrate --advance-ref',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const refsDir = appRefsDir(testDir);

          await runMigrate(testDir, ['--config', configPath, '--no-color']);

          await runMigrate(testDir, [
            '--config',
            configPath,
            '--advance-ref',
            'staging',
            '--no-color',
          ]);
          const firstPointer = readFileSync(refPointerPath(refsDir, 'staging'), 'utf-8');
          const firstStoreContract = readFileSync(
            storeContractJsonPath(refsDir, 'staging'),
            'utf-8',
          );

          await runMigrate(testDir, [
            '--config',
            configPath,
            '--advance-ref',
            'staging',
            '--no-color',
          ]);

          expect(readFileSync(refPointerPath(refsDir, 'staging'), 'utf-8')).toBe(firstPointer);
          expect(readFileSync(storeContractJsonPath(refsDir, 'staging'), 'utf-8')).toBe(
            firstStoreContract,
          );
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'surfaces MIGRATION.INVALID_REF_NAME for an invalid ref name',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const outputStart = consoleOutput.length;

          const exitCode = await runMigrateAllowFailure(testDir, [
            '--config',
            configPath,
            '--advance-ref',
            'bad ref name',
            '--json',
            '--no-color',
          ]);

          expect(exitCode).not.toBe(0);
          const parsed = parseJsonObjectFromCliCapture(consoleOutput.slice(outputStart)) as Record<
            string,
            unknown
          >;
          expect(parsed['code']).toBe('MIGRATION.INVALID_REF_NAME');
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'does not write refs when apply fails before success',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath, contractPath } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const refsDir = appRefsDir(testDir);

          await runMigrate(testDir, ['--config', configPath, '--no-color']);

          replaceInFileOrThrow(
            contractPath!,
            '        email: field.column(textColumn),\n',
            '        email: field.column(textColumn),\n        nickname: field.column(textColumn).optional(),\n',
          );
          await emitContract(testDir, configPath);

          await runMigrateAllowFailure(testDir, [
            '--config',
            configPath,
            '--advance-ref',
            'staging',
            '--json',
            '--no-color',
          ]);

          expect(refFilesAbsent(refsDir, 'staging')).toBe(true);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'does not write refs when --to fails to resolve',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const refsDir = appRefsDir(testDir);
          const outputStart = consoleOutput.length;

          const exitCode = await runMigrateAllowFailure(testDir, [
            '--config',
            configPath,
            '--to',
            'nonexistent-ref-name',
            '--advance-ref',
            'staging',
            '--json',
            '--no-color',
          ]);

          expect(exitCode).not.toBe(0);
          parseJsonObjectFromCliCapture(consoleOutput.slice(outputStart));
          expect(refFilesAbsent(refsDir, 'staging')).toBe(true);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'reports advancedRef as null when --advance-ref is not provided',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const outputStart = consoleOutput.length;

          await runMigrate(testDir, ['--config', configPath, '--json', '--no-color']);

          const parsed = parseJsonObjectFromCliCapture(
            consoleOutput.slice(outputStart),
          ) as MigrateResult;
          expect(parsed.advancedRef).toBeNull();
        });
      },
      timeouts.spinUpPpgDev,
    );
  });
});
