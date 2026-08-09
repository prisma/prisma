import { realpathSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  MigrationOperationClass,
  MigrationPlanOperation,
} from '@internal/framework-components/control';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { formatMigrationDirName, writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { ok } from '@internal/utils/result';
import { type } from 'arktype';
import stripAnsi from 'strip-ansi';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrationShowResultSchema } from '../../src/commands/json/schemas';
import type { MigrationShowPresent } from '../../src/commands/migration-show';
import { formatMigrationShowOutput } from '../../src/utils/formatters/migrations';
import { parseGlobalFlags } from '../../src/utils/global-flags';
import { resolveAppTargetPath } from '../../src/utils/migration-path-target';
import { executeCommand, getExitCode, setupCommandMocks } from '../utils/test-helpers';

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfig,
}));

afterAll(() => {
  // Repo-wide vitest runs with `isolate: false`, so the `vi.mock` leaks
  // into the next file in the same worker; unmock to restore it.
  vi.doUnmock('@internal/config-loader');
  vi.resetModules();
});

const createdTempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = join(
    tmpdir(),
    `test-migration-show-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(dir, { recursive: true });
  createdTempDirs.push(dir);
  return realpathSync(dir);
}

afterEach(async () => {
  const dirs = createdTempDirs.splice(0);
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

function createOp(
  id: string,
  label: string,
  operationClass: MigrationOperationClass,
): MigrationPlanOperation {
  return { id, label, operationClass } as unknown as MigrationPlanOperation;
}

function createMetadata(from: string, to: string): Omit<MigrationMetadata, 'migrationHash'> {
  return {
    from,
    to,
    providedInvariants: [],
    createdAt: new Date().toISOString(),
  };
}

async function setupMigrationDir(
  migrationsDir: string,
  name: string,
  baseMetadata: Omit<MigrationMetadata, 'migrationHash'>,
  ops: MigrationPlanOperation[],
  dateOffset = 0,
): Promise<string> {
  const date = new Date(2026, 0, 1 + dateOffset, 10, 0);
  const dirName = formatMigrationDirName(date, name);
  const packageDir = join(migrationsDir, dirName);
  const metadata: MigrationMetadata = {
    ...baseMetadata,
    migrationHash: computeMigrationHash(baseMetadata, ops),
  };
  await writeMigrationPackage(packageDir, metadata, ops);
  return dirName;
}

function setupConfigMock(): void {
  mocks.loadConfig.mockResolvedValue(
    ok({
      family: {
        familyId: 'mock',
        create: vi.fn().mockReturnValue({
          deserializeContract: (json: unknown) => json,
        }),
      },
      target: {
        id: 'mock',
        familyId: 'mock',
        targetId: 'mock',
        kind: 'target',
        migrations: {
          createPlanner: vi.fn().mockReturnValue({
            emptyMigration: vi.fn(),
          }),
        },
      },
      adapter: { kind: 'adapter', familyId: 'mock', targetId: 'mock' },
      driver: { kind: 'driver', familyId: 'mock', targetId: 'mock' },
      contract: { output: 'src/prisma/contract.json' },
    }),
  );
}

function samplePresent(overrides: Partial<MigrationShowPresent> = {}): MigrationShowPresent {
  return {
    space: 'app',
    name: '20260101_100000_add_user',
    fromContract: null,
    toContract: 'hash-a',
    hash: 'edge-abc',
    createdAt: '2026-01-01T10:00:00.000Z',
    operations: [{ id: 'table.user', label: 'Create table "user"', operationClass: 'additive' }],
    preview: {
      statements: [{ text: 'CREATE TABLE "user" (id int4 NOT NULL)', language: 'sql' }],
    },
    ...overrides,
  };
}

describe('resolveAppTargetPath', () => {
  const migrationsDir = '/tmp/proj/migrations';
  const appMigrationsDir = `${migrationsDir}/app`;
  const appMigrationsRelative = 'migrations/app';

  it('returns the resolved path when the target is inside the app migrations dir', () => {
    const target = `${appMigrationsDir}/20260101_000000_init`;

    const result = resolveAppTargetPath(target, appMigrationsDir, appMigrationsRelative);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(target);
    }
  });

  it('rejects an extension-space package path (sibling of the app dir)', () => {
    const extensionPackage = `${migrationsDir}/cipherstash/0000000001-init`;

    const result = resolveAppTargetPath(extensionPackage, appMigrationsDir, appMigrationsRelative);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.message).toContain('app-space migration');
    }
  });

  it('rejects an unrelated path outside the migrations tree', () => {
    const outsideTarget = '/tmp/other/extensions/cipherstash/0000000001-init';

    const result = resolveAppTargetPath(outsideTarget, appMigrationsDir, appMigrationsRelative);
    expect(result.ok).toBe(false);
  });

  it('rejects the app migrations dir itself as a target', () => {
    const result = resolveAppTargetPath(appMigrationsDir, appMigrationsDir, appMigrationsRelative);
    expect(result.ok).toBe(false);
  });

  it('rejects a cross-drive target where pathe.relative returns an absolute path', () => {
    const windowsAppMigrationsDir = 'C:/app/migrations/app';
    const crossDriveTarget = 'D:/elsewhere/foo';

    const result = resolveAppTargetPath(
      crossDriveTarget,
      windowsAppMigrationsDir,
      'migrations/app',
    );
    expect(result.ok).toBe(false);
  });
});

describe('formatMigrationShowOutput', () => {
  it('shows migration metadata', () => {
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationShowOutput({ migration: samplePresent() }, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('20260101_100000_add_user');
    expect(stripped).toContain('from: (baseline)');
    expect(stripped).toContain('to:   hash-a');
    expect(stripped).not.toContain('── app ──');
  });

  it('shows operations tree with class labels', () => {
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationShowOutput(
      {
        migration: samplePresent({
          operations: [
            { id: 'table.user', label: 'Create table "user"', operationClass: 'additive' },
            {
              id: 'column.post.legacy',
              label: 'Drop column legacy on post',
              operationClass: 'destructive',
            },
          ],
          preview: { statements: [] },
        }),
      },
      flags,
    );
    const stripped = stripAnsi(output);

    expect(stripped).toContain('├');
    expect(stripped).toContain('└');
    expect(stripped).toContain('(destructive)');
  });

  it('returns empty string in quiet mode', () => {
    const flags = parseGlobalFlags({ quiet: true });
    const output = formatMigrationShowOutput(
      { migration: samplePresent({ operations: [] }) },
      flags,
    );

    expect(output).toBe('');
  });
});

describe('migration show command', () => {
  let consoleOutput: string[];
  let cleanupMocks: () => void;
  const originalCwd = process.cwd();

  beforeEach(() => {
    vi.resetModules();
    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    cleanupMocks = commandMocks.cleanup;
    setupConfigMock();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    cleanupMocks();
    vi.clearAllMocks();
  });

  it('errors when target is omitted', async () => {
    const { createMigrationShowCommand } = await import('../../src/commands/migration-show');

    await expect(executeCommand(createMigrationShowCommand(), ['--json'])).rejects.toThrow(
      'process.exit called',
    );
    expect(getExitCode()).not.toBe(0);
  });

  it('errors with contract-not-found when the contract file is missing', async () => {
    const cwd = await createTempDir('no-contract');
    const appDir = join(cwd, 'migrations', 'app');
    await mkdir(appDir, { recursive: true });
    const dirName = await setupMigrationDir(
      appDir,
      'init',
      createMetadata(EMPTY_CONTRACT_HASH, 'abc'),
      [createOp('table.user', 'Create table user', 'additive')],
    );

    process.chdir(cwd);

    const { createMigrationShowCommand } = await import('../../src/commands/migration-show');

    try {
      await executeCommand(createMigrationShowCommand(), [dirName, '--json']);
    } catch {
      // process.exit on failure
    }

    const exitCode = getExitCode();
    expect(exitCode).not.toBe(0);

    const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
    expect(jsonLine).toBeDefined();
    const envelope = JSON.parse(jsonLine!) as { code?: string };
    expect(envelope.code).toBe('CLI.FILE_NOT_FOUND');
  });

  it('resolves a migration directory path argument', async () => {
    const cwd = await createTempDir('path-target');
    const appDir = join(cwd, 'migrations', 'app');
    await mkdir(appDir, { recursive: true });
    const dirName = await setupMigrationDir(
      appDir,
      'init',
      createMetadata(EMPTY_CONTRACT_HASH, 'abc'),
      [createOp('table.user', 'Create table user', 'additive')],
    );

    const contractDir = join(cwd, 'src', 'prisma');
    await mkdir(contractDir, { recursive: true });
    await writeFile(
      join(contractDir, 'contract.json'),
      JSON.stringify({ storage: { storageHash: 'abc', namespaces: {} } }),
    );

    process.chdir(cwd);

    const { createMigrationShowCommand } = await import('../../src/commands/migration-show');

    const dirPath = join(appDir, dirName);
    try {
      await executeCommand(createMigrationShowCommand(), [dirPath, '--json']);
    } catch {
      // process.exit on success/failure
    }

    expect(getExitCode()).toBe(0);
    const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
    expect(jsonLine).toBeDefined();
    const parsed = JSON.parse(jsonLine!);
    expect(migrationShowResultSchema(parsed) instanceof type.errors).toBe(false);
    const result = parsed as {
      ok?: boolean;
      migration?: { name?: string; space?: string };
      summary?: string;
    };
    expect(result.ok).toBe(true);
    expect(result.migration?.name).toBe(dirName);
    expect(result.migration?.space).toBe('app');
    expect(typeof result.summary).toBe('string');
  });

  it('errors with contract validation when contract JSON is invalid', async () => {
    const cwd = await createTempDir('bad-contract');
    const appDir = join(cwd, 'migrations', 'app');
    await mkdir(appDir, { recursive: true });
    const dirName = await setupMigrationDir(
      appDir,
      'init',
      createMetadata(EMPTY_CONTRACT_HASH, 'abc'),
      [createOp('table.user', 'Create table user', 'additive')],
    );

    const contractDir = join(cwd, 'src', 'prisma');
    await mkdir(contractDir, { recursive: true });
    await writeFile(join(contractDir, 'contract.json'), '{ not-json');

    process.chdir(cwd);

    const { createMigrationShowCommand } = await import('../../src/commands/migration-show');

    try {
      await executeCommand(createMigrationShowCommand(), [dirName, '--json']);
    } catch {
      // process.exit on failure
    }

    const exitCode = getExitCode();
    expect(exitCode).not.toBe(0);

    const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
    const envelope = JSON.parse(jsonLine!) as { code?: string };
    expect(envelope.code).toBe('CONTRACT.VALIDATION_FAILED');
  });
});
