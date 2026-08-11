import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createContractEmitCommand } from '@internal/cli/commands/contract-emit';
import { createMigrationPlanCommand } from '@internal/cli/commands/migration-plan';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { contractSnapshotDir } from '@internal/migration-tools/contract-snapshot-store';
import { timeouts, withDevDatabase } from '@repo/test-utils';
import stripAnsi from 'strip-ansi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appendImplicitMigrationPlanFrom,
  executeCommand,
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';
import { type EngineCommandResult, runOnEngine } from './utils/journey-test-helpers';

const execFileAsync = promisify(execFile);
const TSX_BIN = resolve(__dirname, '../../../node_modules/.bin/tsx');
const fixtureSubdir = 'migration-apply';
const workspaceRoot = resolve(__dirname, '../../..');
const HASH_FLOAT = `${'f'.repeat(64)}`;

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

function appRefsDir(testDir: string): string {
  return join(testDir, 'migrations', 'app', 'refs');
}

function refPointerPath(refsDir: string, name: string): string {
  return join(refsDir, `${name}.json`);
}

function refPointerHash(refsDir: string, name: string): string | undefined {
  const pointerPath = refPointerPath(refsDir, name);
  if (!existsSync(pointerPath)) return undefined;
  return (JSON.parse(readFileSync(pointerPath, 'utf-8')) as { hash: string }).hash;
}

function storeContractJsonPath(testDir: string, refsDir: string, name: string): string {
  const hash = refPointerHash(refsDir, name);
  if (hash === undefined) throw new Error(`ref "${name}" has no pointer`);
  return join(contractSnapshotDir(join(testDir, 'migrations'), hash), 'contract.json');
}

// A ref now consists of just its pointer file; the contract bytes resolve
// through the content-addressed store keyed by the pointer's hash.
function refFilesExist(testDir: string, refsDir: string, name: string): boolean {
  const hash = refPointerHash(refsDir, name);
  if (hash === undefined) return false;
  const storeDir = contractSnapshotDir(join(testDir, 'migrations'), hash);
  return existsSync(join(storeDir, 'contract.json')) && existsSync(join(storeDir, 'contract.d.ts'));
}

function refFilesAbsent(refsDir: string, name: string): boolean {
  return !existsSync(refPointerPath(refsDir, name));
}

async function seedPlannedMigration(
  createTempDir: () => string,
  connectionString: string,
): Promise<{ testDir: string; configPath: string; migrationDir: string; toHash: string }> {
  const { testDir, configPath } = setupTestDirectoryFromFixtures(
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
  return { testDir, configPath, migrationDir, toHash: manifest.to };
}

withTempDir(({ createTempDir }) => {
  describe('ref pointer integration (e2e)', () => {
    let cleanupMocks: () => void;

    beforeEach(() => {
      process.chdir(workspaceRoot);
      cleanupMocks = setupCommandMocks().cleanup;
    });

    afterEach(() => {
      process.chdir(workspaceRoot);
      cleanupMocks();
    });

    /**
     * The ref commands run on the engine, so the step is driven through the
     * engine's own harness with the project directory passed as `cwd` — no
     * chdir, no console capture.
     */
    async function runRef(
      testDir: string,
      configPath: string,
      args: readonly string[],
    ): Promise<EngineCommandResult> {
      return runOnEngine({ testDir, configPath, outputDir: join(testDir, 'output') }, [
        'ref',
        ...args,
      ]);
    }

    it(
      'ref set writes only the pointer, ref list lists it, ref delete removes the pointer but leaves the store entry',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath, toHash } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );
          const refsDir = appRefsDir(testDir);
          const bundleEndContract = join(
            contractSnapshotDir(join(testDir, 'migrations'), toHash),
            'contract.json',
          );

          const setResult = await runRef(testDir, configPath, ['set', 'staging', toHash]);
          expect(setResult.exitCode, 'ref set exit code').toBe(0);
          expect(refFilesExist(testDir, refsDir, 'staging')).toBe(true);
          expect(
            JSON.parse(readFileSync(storeContractJsonPath(testDir, refsDir, 'staging'), 'utf-8')),
          ).toEqual(JSON.parse(readFileSync(bundleEndContract, 'utf-8')));

          const listResult = await runRef(testDir, configPath, ['list']);
          expect(listResult.exitCode, 'ref list exit code').toBe(0);
          expect(stripAnsi(listResult.stderr), 'ref list draws the table for the reader').toContain(
            'staging',
          );
          expect(listResult.stdout, 'ref list writes nothing to stdout').toBe('');
          expect(readdirSync(refsDir).filter((name) => name.endsWith('.json'))).toEqual([
            'staging.json',
          ]);

          const deleteResult = await runRef(testDir, configPath, ['delete', 'staging']);
          expect(deleteResult.exitCode, 'ref delete exit code').toBe(0);
          expect(refFilesAbsent(refsDir, 'staging')).toBe(true);
          expect(existsSync(bundleEndContract)).toBe(true);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'refuses a hash that is not in the migration graph',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );

          const result = await runRef(testDir, configPath, [
            'set',
            'staging',
            HASH_FLOAT,
            '--json',
          ]);
          expect(result.exitCode, 'ref set exit code').toBe(2);
          expect(result.json.at(-1)).toMatchObject({
            kind: 'result',
            envelope: {
              ok: false,
              error: { code: 'MIGRATION.HASH_NOT_IN_GRAPH', meta: { resolvedHash: HASH_FLOAT } },
            },
          });
          expect(refFilesAbsent(appRefsDir(testDir), 'staging')).toBe(true);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'refuses the empty-database sentinel hash',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testDir, configPath } = await seedPlannedMigration(
            createTempDir,
            connectionString,
          );

          const result = await runRef(testDir, configPath, ['set', 'staging', EMPTY_CONTRACT_HASH]);
          expect(result.exitCode, 'ref set exit code').toBe(2);
          expect(stripAnsi(result.stderr), 'names the sentinel it refused').toContain(
            'empty-database sentinel',
          );
          expect(refFilesAbsent(appRefsDir(testDir), 'staging')).toBe(true);
        });
      },
      timeouts.spinUpPpgDev,
    );
  });
});
