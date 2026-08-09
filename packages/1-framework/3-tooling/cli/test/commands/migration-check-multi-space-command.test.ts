import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { CliErrorEnvelope } from '@internal/errors/control';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { writeRef } from '@internal/migration-tools/refs';
import { ok } from '@internal/utils/result';
import { join } from 'pathe';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeCommand, getExitCode, setupCommandMocks } from '../utils/test-helpers';

afterAll(() => {
  vi.doUnmock('@internal/config-loader');
  vi.resetModules();
});

/**
 * End-to-end command coverage for `migration check`'s multi-space mode:
 * confirms the no-arg path now reaches non-app spaces, that `--space`
 * narrows, and that `--space <bad>` exits PRECONDITION through the CLI
 * shell (the exit-code contract D6 must not disturb).
 */

const mocks = vi.hoisted(() => ({ loadConfig: vi.fn() }));
vi.mock('@internal/config-loader', () => ({ loadConfigForSections: mocks.loadConfig }));

const TARGET = 'mock';
const TARGET_FAMILY = 'mock';
const HASH_APP = `${'a'.repeat(64)}`;
const HASH_EXT = `${'b'.repeat(64)}`;
const HASH_DANGLING = `${'c'.repeat(64)}`;

const ADDITIVE_OPS: readonly MigrationPlanOperation[] = [
  { id: 'table.users', label: 'Create table users', operationClass: 'additive' },
];

function baseConfig(): Record<string, unknown> {
  return {
    family: {
      familyId: TARGET_FAMILY,
      create: vi.fn().mockReturnValue({ deserializeContract: (json: unknown) => json }),
    },
    target: {
      id: TARGET,
      familyId: TARGET_FAMILY,
      targetId: TARGET,
      kind: 'target',
      migrations: {},
    },
    adapter: { kind: 'adapter', familyId: TARGET_FAMILY, targetId: TARGET },
    driver: { kind: 'driver' },
    db: { connection: 'postgres://localhost/check-multi-space-test' },
    contract: { output: 'src/prisma/contract.json' },
  };
}

async function writePackage(
  migrationsRoot: string,
  spaceId: string,
  dirName: string,
  from: string | null,
  to: string,
): Promise<void> {
  const base: Omit<MigrationMetadata, 'migrationHash'> = {
    from,
    to,
    providedInvariants: [],
    createdAt: '2026-02-25T14:30:00.000Z',
  };
  const metadata: MigrationMetadata = {
    ...base,
    migrationHash: computeMigrationHash(base, ADDITIVE_OPS),
  };
  await writeMigrationPackage(join(migrationsRoot, spaceId, dirName), metadata, ADDITIVE_OPS);
}

async function writeFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'check-multi-space-'));
  const migrationsRoot = join(cwd, 'migrations');
  await writePackage(migrationsRoot, 'app', '20260101T0000_init', null, HASH_APP);
  await writePackage(migrationsRoot, 'postgis', '20260101T0000_install', null, HASH_EXT);
  await writeRef(join(migrationsRoot, 'postgis', 'refs'), 'broken', {
    hash: HASH_DANGLING,
    invariants: [],
  });
  const contractDir = join(cwd, 'src', 'prisma');
  await mkdir(contractDir, { recursive: true });
  await writeFile(
    join(contractDir, 'contract.json'),
    JSON.stringify({
      storage: { storageHash: HASH_APP, namespaces: {} },
      schemaVersion: '1.0.0',
      target: TARGET,
      targetFamily: TARGET_FAMILY,
    }),
  );
  return cwd;
}

async function tamperMigrationHash(pkgDir: string): Promise<void> {
  const manifestPath = join(pkgDir, 'migration.json');
  const raw = JSON.parse(await readFile(manifestPath, 'utf-8')) as Record<string, unknown>;
  raw['migrationHash'] = `${'f'.repeat(64)}`;
  await writeFile(manifestPath, JSON.stringify(raw, null, 2));
}

async function writeFixtureWithTamperedAppHash(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'check-hash-tamper-'));
  const migrationsRoot = join(cwd, 'migrations');
  await writePackage(migrationsRoot, 'app', '20260101T0000_init', null, HASH_APP);
  await tamperMigrationHash(join(migrationsRoot, 'app', '20260101T0000_init'));
  await writePackage(migrationsRoot, 'postgis', '20260101T0000_install', null, HASH_EXT);
  const contractDir = join(cwd, 'src', 'prisma');
  await mkdir(contractDir, { recursive: true });
  await writeFile(
    join(contractDir, 'contract.json'),
    JSON.stringify({
      storage: { storageHash: HASH_APP, namespaces: {} },
      schemaVersion: '1.0.0',
      target: TARGET,
      targetFamily: TARGET_FAMILY,
    }),
  );
  return cwd;
}

function firstJsonLine<T>(consoleOutput: readonly string[]): T {
  const line = consoleOutput.find((l) => l.trimStart().startsWith('{'));
  if (!line) {
    throw new Error(`Expected a JSON object on stdout; got:\n${consoleOutput.join('\n')}`);
  }
  return JSON.parse(line) as T;
}

async function runAndCaptureExit(invoke: () => Promise<number>): Promise<number> {
  try {
    return await invoke();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'process.exit called') {
      throw error;
    }
    return getExitCode() ?? 0;
  }
}

interface CheckResultEnvelope {
  readonly ok: boolean;
  readonly failures: ReadonlyArray<{ readonly code: string; readonly where: string }>;
  readonly summary: string;
}

describe('migration check multi-space (command)', () => {
  let consoleOutput: string[];
  let cleanup: () => void;
  const originalCwd = process.cwd();
  let tempDir: string | undefined;

  beforeEach(() => {
    vi.resetModules();
    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    cleanup = commandMocks.cleanup;
    mocks.loadConfig.mockResolvedValue(ok(baseConfig()));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    cleanup();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
    vi.clearAllMocks();
  });

  it('no-arg check surfaces a dangling ref in a non-app space and exits INTEGRITY_FAILED', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixture();
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), ['--json']),
    );
    const result = firstJsonLine<CheckResultEnvelope>(consoleOutput);

    expect(exitCode).toBe(4);
    expect(result.ok).toBe(false);
    const dangling = result.failures.filter((f) => f.code === 'MIGRATION.CHECK_DANGLING_REF');
    expect(dangling).toHaveLength(1);
    expect(dangling[0]?.where).toContain('postgis');
  });

  it('--space app narrows to the app space (clean) and exits OK', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixture();
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), ['--space', 'app', '--json']),
    );
    const result = firstJsonLine<CheckResultEnvelope>(consoleOutput);

    expect(exitCode).toBe(0);
    expect(result.ok).toBe(true);
  });

  it('--space <bad-id> exits PRECONDITION with INVALID_SPACE_ID', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixture();
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), ['--space', '../escape', '--json']),
    );
    const envelope = firstJsonLine<CliErrorEnvelope>(consoleOutput);

    expect(exitCode).toBe(2);
    expect(envelope.ok).toBe(false);
    expect(envelope.code).toBe('MIGRATION.INVALID_SPACE_ID');
  });
});

describe('migration check --space narrows aggregate integrity violations (command)', () => {
  let consoleOutput: string[];
  let cleanup: () => void;
  const originalCwd = process.cwd();
  let tempDir: string | undefined;

  beforeEach(() => {
    vi.resetModules();
    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    cleanup = commandMocks.cleanup;
    mocks.loadConfig.mockResolvedValue(ok(baseConfig()));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    cleanup();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
    vi.clearAllMocks();
  });

  it('no-arg check reports an app-space hash-mismatch via the aggregate path', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixtureWithTamperedAppHash();
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), ['--json']),
    );
    const result = firstJsonLine<CheckResultEnvelope>(consoleOutput);

    expect(exitCode).toBe(4);
    expect(result.ok).toBe(false);
    const hashFailures = result.failures.filter((f) => f.code === 'MIGRATION.CHECK_HASH_MISMATCH');
    expect(hashFailures).toHaveLength(1);
    expect(hashFailures[0]?.where).toContain('app');
  });

  it('--space app reports an app-space hash-mismatch (aggregate integrity narrowed to space)', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixtureWithTamperedAppHash();
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), ['--space', 'app', '--json']),
    );
    const result = firstJsonLine<CheckResultEnvelope>(consoleOutput);

    expect(exitCode).toBe(4);
    expect(result.ok).toBe(false);
    const hashFailures = result.failures.filter((f) => f.code === 'MIGRATION.CHECK_HASH_MISMATCH');
    expect(hashFailures).toHaveLength(1);
    expect(hashFailures[0]?.where).toContain('app');
  });

  it('--space postgis does not report an app-space hash-mismatch (no cross-space contamination)', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixtureWithTamperedAppHash();
    process.chdir(tempDir);

    await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), ['--space', 'postgis', '--json']),
    );
    const result = firstJsonLine<CheckResultEnvelope>(consoleOutput);

    const appHashFailures = result.failures.filter(
      (f) => f.code === 'MIGRATION.CHECK_HASH_MISMATCH' && f.where.includes('app'),
    );
    expect(appHashFailures).toHaveLength(0);
  });
});
