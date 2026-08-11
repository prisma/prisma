import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { writeRef } from '@internal/migration-tools/refs';
import { ok } from '@internal/utils/result';
import { timeouts } from '@repo/test-utils';
import { join } from 'pathe';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeCommand, getExitCode, setupCommandMocks } from '../utils/test-helpers';

/**
 * Integration coverage for the UNKNOWN_INVARIANT pre-check in
 * `migrate --to` and `migration status --to` — the only
 * invariant-routing diagnostic reachable without a real DB connection.
 * Marker-subtraction and NO_INVARIANT_PATH live in the journey suite.
 */

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfig,
}));

const FROM_HASH = 'empty';
const TO_HASH = `${'a'.repeat(64)}`;
const SCHEMA_VERSION = '1.0.0';
const TARGET = 'mock';
const TARGET_FAMILY = 'mock';
const CREATED_AT = '2026-02-25T14:30:00.000Z';

const ORIGINAL_OPS: readonly MigrationPlanOperation[] = [
  { id: 'table.users', label: 'Create table users', operationClass: 'additive' },
];

function dataOp(invariantId: string): MigrationPlanOperation {
  return {
    id: `data_migration.${invariantId}`,
    label: `Data transform: ${invariantId}`,
    operationClass: 'data',
    invariantId,
  };
}

interface InvariantFixture {
  readonly cwd: string;
}

async function writeAttestedPackage(
  packageDir: string,
  metadataBase: Omit<MigrationMetadata, 'migrationHash'>,
  ops: readonly MigrationPlanOperation[],
): Promise<void> {
  const metadata: MigrationMetadata = {
    ...metadataBase,
    migrationHash: computeMigrationHash(metadataBase, ops),
  };
  await writeMigrationPackage(packageDir, metadata, ops);
}

function setupConfigMock(
  options: { markerInvariants?: readonly string[]; markerHash?: string } = {},
): void {
  const markerRecord =
    options.markerHash !== undefined
      ? {
          storageHash: options.markerHash,
          invariants: options.markerInvariants ?? [],
        }
      : null;
  const familyInstance = {
    readMarker: vi.fn().mockResolvedValue(markerRecord),
    readAllMarkers: vi
      .fn()
      .mockResolvedValue(markerRecord ? new Map([['app', markerRecord]]) : new Map()),
    readLedger: vi.fn().mockResolvedValue([]),
    // Pass-through `deserializeContract` stub: the invariant tests construct
    // a skeletal contract for the read site (TML-2536 routes every on-disk
    // contract read through this seam), but the bugs under test are about
    // invariant routing, not contract validation. The stub keeps the seam
    // crossing in place without requiring a full hydrated contract fixture.
    deserializeContract: (json: unknown) => json,
  };
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
      driver: {
        kind: 'driver',
        create: vi.fn().mockResolvedValue({ close: vi.fn().mockResolvedValue(undefined) }),
      },
      db: { connection: 'postgres://localhost/invariant-test' },
      // Per-test fixtures write contract.json under <cwd>/src/prisma/. Each
      // test chdirs to its tempdir before invoking the command.
      contract: { output: 'src/prisma/contract.json' },
    }),
  );
}

async function setupDivergentFixture(): Promise<InvariantFixture & { refHash: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'cli-invariant-'));
  const migrationsDir = join(cwd, 'migrations', 'app');
  await mkdir(migrationsDir, { recursive: true });

  const REF_HASH = `${'b'.repeat(64)}`;

  // Branch A (will be the marker) — EMPTY → TO_HASH.
  await writeAttestedPackage(
    join(migrationsDir, '00001_branch_a'),
    {
      from: FROM_HASH,
      to: TO_HASH,
      providedInvariants: [],
      createdAt: '2026-02-25T14:00:00.000Z',
    },
    ORIGINAL_OPS,
  );

  // Branch B (the ref target) — EMPTY → REF_HASH. No path from TO_HASH to
  // REF_HASH, so a marker on TO_HASH cannot reach REF_HASH.
  await writeAttestedPackage(
    join(migrationsDir, '00002_branch_b'),
    {
      from: FROM_HASH,
      to: REF_HASH,
      providedInvariants: [],
      createdAt: '2026-02-25T14:01:00.000Z',
    },
    ORIGINAL_OPS,
  );

  const refsDir = join(migrationsDir, 'refs');
  await writeRef(refsDir, 'prod', { hash: REF_HASH, invariants: [] });

  const contractDir = join(cwd, 'src', 'prisma');
  await mkdir(contractDir, { recursive: true });
  await writeFile(
    join(contractDir, 'contract.json'),
    JSON.stringify({
      storage: { storageHash: REF_HASH, namespaces: {} },
      schemaVersion: SCHEMA_VERSION,
      target: TARGET,
      targetFamily: TARGET_FAMILY,
    }),
  );

  return { cwd, refHash: REF_HASH };
}

async function setupFixture(opts: {
  refInvariants: readonly string[];
  edgeInvariants?: readonly string[];
}): Promise<InvariantFixture> {
  const cwd = await mkdtemp(join(tmpdir(), 'cli-invariant-'));

  const migrationsDir = join(cwd, 'migrations', 'app');
  await mkdir(migrationsDir, { recursive: true });

  const packageDir = join(migrationsDir, '00001_create_users');
  const edgeInvariants = [...(opts.edgeInvariants ?? [])].sort();
  const ops: readonly MigrationPlanOperation[] = [...ORIGINAL_OPS, ...edgeInvariants.map(dataOp)];
  await writeAttestedPackage(
    packageDir,
    {
      from: FROM_HASH,
      to: TO_HASH,
      providedInvariants: edgeInvariants,
      createdAt: CREATED_AT,
    },
    ops,
  );

  // Ref pointing at the only attested migration's destination, declaring the
  // ref-side invariants.
  const refsDir = join(migrationsDir, 'refs');
  await writeRef(refsDir, 'prod', { hash: TO_HASH, invariants: opts.refInvariants });

  // contract.json — apply reads the contract envelope when no --ref is given.
  const contractDir = join(cwd, 'src', 'prisma');
  await mkdir(contractDir, { recursive: true });
  await writeFile(
    join(contractDir, 'contract.json'),
    JSON.stringify({
      storage: { storageHash: TO_HASH, namespaces: {} },
      schemaVersion: SCHEMA_VERSION,
      target: TARGET,
      targetFamily: TARGET_FAMILY,
    }),
  );

  return { cwd };
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

describe('migrate / migration status — invariant-routing pre-checks', {
  timeout: timeouts.typeScriptCompilation,
}, () => {
  let consoleOutput: string[];
  let consoleErrors: string[];
  let cleanupMocks: () => void;
  const originalCwd = process.cwd();
  let tempDirs: string[];

  beforeEach(() => {
    vi.resetModules();
    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    consoleErrors = commandMocks.consoleErrors;
    cleanupMocks = commandMocks.cleanup;
    tempDirs = [];
    setupConfigMock();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    cleanupMocks();
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.doUnmock('@internal/config-loader');
    vi.resetModules();
  });

  it('migrate --to fails with UNKNOWN_INVARIANT when ref names an undeclared invariant', async () => {
    const { createMigrateCommand } = await import('../../src/commands/migrate');
    const fixture = await setupFixture({
      refInvariants: ['typo-id'],
      edgeInvariants: ['real-id'],
    });
    tempDirs.push(fixture.cwd);
    process.chdir(fixture.cwd);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrateCommand(), ['--to', 'prod', '--json']),
    );

    expect(exitCode).not.toBe(0);
    const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
    expect(jsonLine).toBeDefined();
    const envelope = JSON.parse(jsonLine!) as {
      code?: string;
      meta?: { unknown?: string[]; declared?: string[] };
    };
    expect(envelope.code).toBe('MIGRATION.UNKNOWN_INVARIANT');
    expect(envelope.meta?.unknown).toEqual(['typo-id']);
    expect(envelope.meta?.declared).toEqual(['real-id']);
  });

  it('migration status --to fails with UNKNOWN_INVARIANT (parity with migrate, not a warning)', async () => {
    setupConfigMock({ markerHash: TO_HASH });
    const { createMigrationStatusCommand } = await import('../../src/commands/migration-status');
    const fixture = await setupFixture({
      refInvariants: ['typo-id'],
      edgeInvariants: ['real-id'],
    });
    tempDirs.push(fixture.cwd);
    process.chdir(fixture.cwd);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationStatusCommand(), ['--to', 'prod', '--json']),
    );

    expect(exitCode).not.toBe(0);
    const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
    expect(jsonLine).toBeDefined();
    const envelope = JSON.parse(jsonLine!) as { code?: string };
    expect(envelope.code).toBe('MIGRATION.UNKNOWN_INVARIANT');
  });

  it('migrate --to does not fire UNKNOWN_INVARIANT when a retired invariant is already on the marker', async () => {
    // Ref carries `retired-id`. No on-disk migration declares it any more
    // (history was rewritten). The marker still records it as applied.
    // Apply should treat the requirement as already satisfied — not
    // surface MIGRATION.UNKNOWN_INVARIANT.
    cleanupMocks();
    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    consoleErrors = commandMocks.consoleErrors;
    cleanupMocks = commandMocks.cleanup;
    setupConfigMock({ markerHash: TO_HASH, markerInvariants: ['retired-id'] });

    const { createMigrateCommand } = await import('../../src/commands/migrate');
    const fixture = await setupFixture({
      refInvariants: ['retired-id'],
      edgeInvariants: [],
    });
    tempDirs.push(fixture.cwd);
    process.chdir(fixture.cwd);

    await runAndCaptureExit(() =>
      executeCommand(createMigrateCommand(), ['--to', 'prod', '--json']),
    );

    // The contract under test is the pre-check: an invariant that
    // is recorded on the marker but no longer declared by any
    // on-disk migration must be folded into the "known" set so
    // UNKNOWN_INVARIANT is *not* surfaced. Apply itself may go on
    // to fail downstream (the mock environment doesn't wire a
    // full runner) — the assertion is on the absence
    // of the misleading diagnostic, not on the apply outcome.
    expect(consoleErrors.join('\n')).not.toContain('MIGRATION.UNKNOWN_INVARIANT');
    expect(consoleOutput.join('\n')).not.toContain('MIGRATION.UNKNOWN_INVARIANT');
  });

  it('migration status --to (online) does not fire UNKNOWN_INVARIANT when a retired invariant is already on the marker', async () => {
    cleanupMocks();
    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    consoleErrors = commandMocks.consoleErrors;
    cleanupMocks = commandMocks.cleanup;
    setupConfigMock({ markerHash: TO_HASH, markerInvariants: ['retired-id'] });

    const { createMigrationStatusCommand } = await import('../../src/commands/migration-status');
    const fixture = await setupFixture({
      refInvariants: ['retired-id'],
      edgeInvariants: [],
    });
    tempDirs.push(fixture.cwd);
    process.chdir(fixture.cwd);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationStatusCommand(), ['--to', 'prod', '--json']),
    );

    const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
    if (jsonLine !== undefined && exitCode !== 0) {
      const envelope = JSON.parse(jsonLine) as { code?: string };
      expect(envelope.code).not.toBe('MIGRATION.UNKNOWN_INVARIANT');
    }
    expect(consoleErrors.join('\n')).not.toContain('MIGRATION.UNKNOWN_INVARIANT');
  });

  it('migration status --to does not emit MIGRATION.UP_TO_DATE when the marker cannot reach the ref', async () => {
    // Marker is on a branch that has no forward path to the ref's branch.
    // pendingCount and hasInvariantWork both report 0, but
    // MIGRATION.UP_TO_DATE would mislead — the database simply cannot
    // reach the ref from its current state. Suppress the diagnostic.
    cleanupMocks();
    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    consoleErrors = commandMocks.consoleErrors;
    cleanupMocks = commandMocks.cleanup;
    setupConfigMock({ markerHash: TO_HASH });

    const { createMigrationStatusCommand } = await import('../../src/commands/migration-status');
    const fixture = await setupDivergentFixture();
    tempDirs.push(fixture.cwd);
    process.chdir(fixture.cwd);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationStatusCommand(), ['--to', 'prod', '--json']),
    );
    expect(exitCode).toBe(0);

    const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
    expect(jsonLine).toBeDefined();
    const envelope = JSON.parse(jsonLine!) as { summary?: string };
    expect(envelope.summary).not.toBe('up to date');
  });

  it('migrate --to does not fire UNKNOWN_INVARIANT when the ref invariant list is empty', async () => {
    // A ref with no invariants must not trip the pre-check. The command
    // continues to its next failure mode (driver no-op connect in this
    // mock setup); we just assert the error code is NOT UNKNOWN_INVARIANT.
    const { createMigrateCommand } = await import('../../src/commands/migrate');
    const fixture = await setupFixture({
      refInvariants: [],
      edgeInvariants: ['real-id'],
    });
    tempDirs.push(fixture.cwd);
    process.chdir(fixture.cwd);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrateCommand(), ['--to', 'prod', '--json']),
    );

    const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
    // Either the command succeeded (exit 0, no JSON envelope), or it failed
    // for a *later* reason (driver/runner) — but never with UNKNOWN_INVARIANT.
    if (jsonLine !== undefined && exitCode !== 0) {
      const envelope = JSON.parse(jsonLine) as { code?: string };
      expect(envelope.code).not.toBe('MIGRATION.UNKNOWN_INVARIANT');
    }
    expect(consoleErrors.join('\n')).not.toContain('MIGRATION.UNKNOWN_INVARIANT');
  });
});
