import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import {
  contractSnapshotDir,
  writeContractSnapshot,
} from '@internal/migration-tools/contract-snapshot-store';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { ok } from '@internal/utils/result';
import { join, relative } from 'pathe';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  executeCommand,
  getExitCode,
  parseJsonObjectFromCliCapture,
  setupCommandMocks,
} from '../utils/test-helpers';

/**
 * `migrate --to <node>` verifies/applies against the TARGET bundle's
 * destination contract (resolved from the contract snapshot store, keyed by
 * the bundle's `to` hash), not the emitted `contract.json`. This is what
 * lets a rollback / arbitrary-target migrate succeed without first
 * re-emitting the target contract. With `--to` omitted, the emitted
 * contract stays the apply contract.
 *
 * The control client is mocked so the assertion is purely about *which*
 * contract `migrate` hands to `client.migrate` — path resolution and the real
 * migration run are covered by the PGlite journey suite.
 */

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  createControlClient: vi.fn(),
  migrate: vi.fn(),
  readAllMarkers: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({ loadConfigForSections: mocks.loadConfig }));
vi.mock('../../src/control-api/client', () => ({
  createControlClient: mocks.createControlClient,
}));

const EMPTY = 'empty';
const C1 = `${'1'.repeat(64)}`;
const C2 = `${'2'.repeat(64)}`;
const SCHEMA_VERSION = '1.0.0';
const TARGET = 'mock';
const TARGET_FAMILY = 'mock';

const OPS: readonly MigrationPlanOperation[] = [
  { id: 'table.users', label: 'Create table users', operationClass: 'additive' },
];

function contractEnvelope(storageHash: string): Record<string, unknown> {
  return {
    storage: { storageHash, namespaces: {} },
    schemaVersion: SCHEMA_VERSION,
    target: TARGET,
    targetFamily: TARGET_FAMILY,
  };
}

async function writeBundle(
  migrationsDir: string,
  dir: string,
  base: Omit<MigrationMetadata, 'migrationHash'>,
  endContractHash: string,
): Promise<void> {
  const metadata: MigrationMetadata = { ...base, migrationHash: computeMigrationHash(base, OPS) };
  await writeMigrationPackage(dir, metadata, OPS);
  await writeContractSnapshot(migrationsDir, endContractHash, {
    contractJson: contractEnvelope(endContractHash),
    contractDts: 'export type Contract = unknown;\n',
  });
}

/**
 * Linear two-migration applied state (EMPTY → C1 → C2). The emitted contract
 * is C2 (the current state); the DB marker sits at C2.
 */
async function setupAppliedState(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'cli-migrate-to-'));
  const migrationsDir = join(cwd, 'migrations');
  const appDir = join(migrationsDir, 'app');
  await mkdir(join(appDir, 'refs'), { recursive: true });

  await writeBundle(
    migrationsDir,
    join(appDir, '00001_init'),
    { from: EMPTY, to: C1, providedInvariants: [], createdAt: '2026-02-25T14:00:00.000Z' },
    C1,
  );
  await writeBundle(
    migrationsDir,
    join(appDir, '00002_add_phone'),
    { from: C1, to: C2, providedInvariants: [], createdAt: '2026-02-25T14:01:00.000Z' },
    C2,
  );

  await writeFile(join(cwd, 'contract.json'), JSON.stringify(contractEnvelope(C2)));
  return cwd;
}

function setupConfigMock(): void {
  const familyInstance = { deserializeContract: (json: unknown) => json };
  mocks.loadConfig.mockResolvedValue(
    ok({
      family: { familyId: TARGET_FAMILY, create: vi.fn().mockReturnValue(familyInstance) },
      target: {
        id: TARGET,
        familyId: TARGET_FAMILY,
        targetId: TARGET,
        kind: 'target',
        migrations: {},
      },
      adapter: { kind: 'adapter', familyId: TARGET_FAMILY, targetId: TARGET },
      driver: { kind: 'driver', create: vi.fn() },
      db: { connection: 'postgres://localhost/migrate-to-test' },
      contract: { output: 'contract.json' },
    }),
  );
}

function capturedApplyContractHash(): string {
  const firstCall = mocks.migrate.mock.calls[0];
  expect(firstCall, 'migrate was invoked').toBeDefined();
  const arg = firstCall![0] as { contract: { storage: { storageHash: string } } };
  return arg.contract.storage.storageHash;
}

async function runAndCaptureExit(invoke: () => Promise<number>): Promise<number> {
  try {
    return await invoke();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'process.exit called') throw error;
    return getExitCode() ?? 0;
  }
}

describe('migrate --to verifies against the target bundle contract', () => {
  let cleanupMocks: () => void;
  let consoleOutput: string[];
  const originalCwd = process.cwd();
  let tempDirs: string[];

  beforeEach(() => {
    vi.resetModules();
    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    cleanupMocks = commandMocks.cleanup;
    tempDirs = [];

    setupConfigMock();
    mocks.readAllMarkers.mockResolvedValue(new Map([['app', { storageHash: C2, invariants: [] }]]));
    mocks.migrate.mockResolvedValue({
      ok: true,
      value: {
        migrationsApplied: 1,
        markerHash: C1,
        applied: [],
        summary: 'applied',
        perSpace: [],
      },
    });
    mocks.createControlClient.mockReturnValue({
      connect: vi.fn().mockResolvedValue(undefined),
      readAllMarkers: mocks.readAllMarkers,
      migrate: mocks.migrate,
      close: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    cleanupMocks();
    for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.doUnmock('@internal/config-loader');
    vi.doUnmock('../../src/control-api/client');
    vi.resetModules();
  });

  it('applies the target bundle destination contract when --to names an older graph node', async () => {
    const { createMigrateCommand } = await import('../../src/commands/migrate');
    const cwd = await setupAppliedState();
    tempDirs.push(cwd);
    process.chdir(cwd);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrateCommand(), ['--to', C1, '--json']),
    );

    expect(exitCode).toBe(0);
    // Not the emitted contract (C2) — the resolved target's contract (C1).
    expect(capturedApplyContractHash()).toBe(C1);
  });

  it('applies the emitted contract when --to is omitted', async () => {
    const { createMigrateCommand } = await import('../../src/commands/migrate');
    const cwd = await setupAppliedState();
    tempDirs.push(cwd);
    process.chdir(cwd);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrateCommand(), ['--json']),
    );

    expect(exitCode).toBe(0);
    expect(capturedApplyContractHash()).toBe(C2);
  });

  it('reports contract validation failure naming a corrupt target store entry', async () => {
    const { createMigrateCommand } = await import('../../src/commands/migrate');
    const cwd = await setupAppliedState();
    tempDirs.push(cwd);
    const targetSnapshotPath = join(
      contractSnapshotDir(join(cwd, 'migrations'), C1),
      'contract.json',
    );
    const endContractRel = relative(cwd, targetSnapshotPath);
    await writeFile(targetSnapshotPath, '{ not json');
    process.chdir(cwd);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrateCommand(), ['--to', C1, '--json']),
    );

    expect(exitCode).not.toBe(0);
    const envelope = parseJsonObjectFromCliCapture(consoleOutput) as {
      code?: string;
      summary?: string;
      why?: string;
      where?: { path?: string };
    };
    expect(envelope.code).toBe('CONTRACT.VALIDATION_FAILED');
    expect(envelope.summary).toContain('Contract validation failed');
    expect(envelope.where?.path).toContain(endContractRel);
    expect(envelope.why).toContain(endContractRel);
    expect(mocks.migrate).not.toHaveBeenCalled();
  });

  // Regression lock for TML-2478: the top-level `contract.json` read at the
  // migrate command entry must return a structured `notOk` envelope, never
  // throw past `handleResult`. (Distinct from the corrupt target-bundle
  // store-entry case above, which is reached later via `contractAt`.)
  it('reports file-not-found when the top-level contract.json is absent', async () => {
    const { createMigrateCommand } = await import('../../src/commands/migrate');
    const cwd = await mkdtemp(join(tmpdir(), 'cli-migrate-preflight-'));
    tempDirs.push(cwd);
    process.chdir(cwd);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrateCommand(), ['--json']),
    );

    expect(exitCode).not.toBe(0);
    const envelope = parseJsonObjectFromCliCapture(consoleOutput) as {
      code?: string;
      summary?: string;
      where?: { path?: string };
    };
    expect(envelope.code).toBe('CLI.FILE_NOT_FOUND');
    expect(envelope.summary).toContain('File not found');
    expect(envelope.where?.path).toContain('contract.json');
    expect(mocks.migrate).not.toHaveBeenCalled();
  });

  it('reports contract validation failure when the top-level contract.json is unparseable', async () => {
    const { createMigrateCommand } = await import('../../src/commands/migrate');
    const cwd = await mkdtemp(join(tmpdir(), 'cli-migrate-preflight-'));
    tempDirs.push(cwd);
    await writeFile(join(cwd, 'contract.json'), '{ not json');
    process.chdir(cwd);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrateCommand(), ['--json']),
    );

    expect(exitCode).not.toBe(0);
    const envelope = parseJsonObjectFromCliCapture(consoleOutput) as {
      code?: string;
      summary?: string;
      where?: { path?: string };
    };
    expect(envelope.code).toBe('CONTRACT.VALIDATION_FAILED');
    expect(envelope.summary).toContain('Contract validation failed');
    expect(envelope.where?.path).toContain('contract.json');
    expect(mocks.migrate).not.toHaveBeenCalled();
  });
});
