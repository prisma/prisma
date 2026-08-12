import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

/**
 * Command-level tests for `migration check <ref>` single-target multi-space
 * resolution (TML-2835). Verifies:
 *   (a) a migration planted in a NON-app space is resolved + checked;
 *   (b) `--space <id>` narrows single-target; invalid/unknown --space exits PRECONDITION;
 *   (c) a ref ambiguous across spaces errors PRECONDITION with the qualify-with-`--space` message.
 */

const mocks = vi.hoisted(() => ({ loadConfig: vi.fn() }));
vi.mock('@internal/config-loader', () => ({ loadConfigForSections: mocks.loadConfig }));

afterAll(() => {
  vi.doUnmock('@internal/config-loader');
  vi.resetModules();
});

const TARGET = 'mock';
const TARGET_FAMILY = 'mock';
const HASH_APP = `${'a'.repeat(64)}`;
const HASH_EXT = `${'b'.repeat(64)}`;

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
    db: { connection: 'postgres://localhost/check-single-target-test' },
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

async function writeContractJson(cwd: string): Promise<void> {
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
}

async function writeFixtureWithExtSpace(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'check-single-multi-'));
  const migrationsRoot = join(cwd, 'migrations');
  await writePackage(migrationsRoot, 'app', '20260101T0000_app_init', null, HASH_APP);
  await writePackage(migrationsRoot, 'postgis', '20260601T0000_install_postgis', null, HASH_EXT);
  await writeContractJson(cwd);
  return cwd;
}

async function writeFixtureWithAmbiguousRef(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'check-single-ambiguous-'));
  const migrationsRoot = join(cwd, 'migrations');
  // Both spaces get a migration with the same directory name so a dirName ref resolves in both.
  await writePackage(migrationsRoot, 'app', '20260101T0000_shared_name', null, HASH_APP);
  await writePackage(migrationsRoot, 'postgis', '20260101T0000_shared_name', null, HASH_EXT);
  await writeContractJson(cwd);
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

describe('migration check <ref> — single-target multi-space resolution', () => {
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

  it('(a) resolves + checks a migration in a NON-app space by dirName ref (was PRECONDITION not-found)', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixtureWithExtSpace();
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), ['20260601T0000_install_postgis', '--json']),
    );
    const result = firstJsonLine<CheckResultEnvelope>(consoleOutput);

    expect(exitCode).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('(b) --space <id> narrows single-target: ref in that space succeeds', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixtureWithExtSpace();
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), [
        '20260601T0000_install_postgis',
        '--space',
        'postgis',
        '--json',
      ]),
    );
    const result = firstJsonLine<CheckResultEnvelope>(consoleOutput);

    expect(exitCode).toBe(0);
    expect(result.ok).toBe(true);
  });

  it('(b) --space <id> narrows single-target: ref NOT in that space → not-found PRECONDITION', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixtureWithExtSpace();
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), [
        '20260601T0000_install_postgis',
        '--space',
        'app',
        '--json',
      ]),
    );

    expect(exitCode).toBe(2);
    const envelope = firstJsonLine<CliErrorEnvelope>(consoleOutput);
    expect(envelope.ok).toBe(false);
  });

  it('(b) --space <invalid-id> → PRECONDITION INVALID_SPACE_ID', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixtureWithExtSpace();
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), [
        '20260601T0000_install_postgis',
        '--space',
        '../escape',
        '--json',
      ]),
    );
    const envelope = firstJsonLine<CliErrorEnvelope>(consoleOutput);

    expect(exitCode).toBe(2);
    expect(envelope.ok).toBe(false);
    expect(envelope.code).toBe('MIGRATION.INVALID_SPACE_ID');
  });

  it('(b) --space <unknown-id> → PRECONDITION SPACE_NOT_FOUND', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixtureWithExtSpace();
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), [
        '20260601T0000_install_postgis',
        '--space',
        'nope',
        '--json',
      ]),
    );
    const envelope = firstJsonLine<CliErrorEnvelope>(consoleOutput);

    expect(exitCode).toBe(2);
    expect(envelope.ok).toBe(false);
    expect(envelope.code).toBe('MIGRATION.SPACE_NOT_FOUND');
    expect(envelope.meta?.['spaceId']).toBe('nope');
  });

  it('(c) ref ambiguous across two spaces → PRECONDITION with qualify-with-`--space` message', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixtureWithAmbiguousRef();
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), ['20260101T0000_shared_name', '--json']),
    );
    const envelope = firstJsonLine<CliErrorEnvelope>(consoleOutput);

    expect(exitCode).toBe(2);
    expect(envelope.ok).toBe(false);
    expect(envelope.code).toBe('MIGRATION.AMBIGUOUS_MIGRATION_REF');
    expect(envelope.summary).toContain('--space');
  });

  it('ref in non-app space with --space pointing to a different space uses the ref from a clean app-space ref for the narrowed space', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixtureWithExtSpace();
    process.chdir(tempDir);

    // app ref; narrowed to postgis → should not find it → not-found PRECONDITION
    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), [
        '20260101T0000_app_init',
        '--space',
        'postgis',
        '--json',
      ]),
    );

    expect(exitCode).toBe(2);
  });

  it('ref in app space resolves when no --space given (all spaces searched)', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixtureWithExtSpace();
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), ['20260101T0000_app_init', '--json']),
    );
    const result = firstJsonLine<CheckResultEnvelope>(consoleOutput);

    expect(exitCode).toBe(0);
    expect(result.ok).toBe(true);
  });

  it('named contract ref (e.g. `db`) is not a valid migration ref — exits PRECONDITION', async () => {
    // Named refs (e.g. `db`) are contract refs; `parseMigrationRef` treats them as wrong-grammar.
    // This is per-spec: migration check single-target accepts dirName or hash prefix, not ref names.
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixtureWithExtSpace();
    await writeRef(join(tempDir, 'migrations', 'postgis', 'refs'), 'db', {
      hash: HASH_EXT,
      invariants: [],
    });
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), ['db', '--space', 'postgis', '--json']),
    );

    expect(exitCode).toBe(2);
  });

  it('keeps the most informative parse failure across spaces (wrong-grammar beats an earlier not-found)', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixtureWithExtSpace();
    // `dbref` is a ref only in postgis, so parseMigrationRef returns wrong-grammar
    // there but not-found in app (which is searched first). The reported error must
    // reflect postgis's wrong-grammar failure, not app's earlier not-found.
    await writeRef(join(tempDir, 'migrations', 'postgis', 'refs'), 'dbref', {
      hash: HASH_EXT,
      invariants: [],
    });
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), ['dbref', '--json']),
    );
    const envelope = firstJsonLine<CliErrorEnvelope>(consoleOutput);

    expect(exitCode).toBe(2);
    expect(envelope.ok).toBe(false);
    // wrong-grammar envelopes carry meta.expectedGrammar; not-found carries meta.grammar.
    expect(envelope.meta?.['expectedGrammar']).toBeDefined();
    expect(envelope.meta?.['grammar']).toBeUndefined();
  });
});
