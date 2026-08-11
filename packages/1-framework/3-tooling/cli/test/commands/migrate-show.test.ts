import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { writeContractSnapshot } from '@internal/migration-tools/contract-snapshot-store';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { writeRef } from '@internal/migration-tools/refs';
import { ok } from '@internal/utils/result';
import stripAnsi from 'strip-ansi';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeCommand, getExitCode, setupCommandMocks } from '../utils/test-helpers';

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  createControlClient: vi.fn(),
  readAllMarkers: vi.fn(),
  runMigration: vi.fn(),
  resolveRecordedPath: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({ loadConfigForSections: mocks.loadConfig }));
vi.mock('../../src/control-api/client', () => ({
  createControlClient: mocks.createControlClient,
}));
// Spy on resolveRecordedPath to assert it is the seam used for path computation.
vi.mock('@internal/migration-tools/aggregate', async (importOriginal) => {
  const original = await importOriginal<typeof import('@internal/migration-tools/aggregate')>();
  return {
    ...original,
    resolveRecordedPath: mocks.resolveRecordedPath.mockImplementation(original.resolveRecordedPath),
  };
});
// runMigration is the write boundary — if --show ever calls it, tests must fail.
vi.mock('../../src/control-api/operations/run-migration', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/control-api/operations/run-migration')>();
  return {
    ...original,
    runMigration: mocks.runMigration.mockImplementation(() => {
      throw new Error('runMigration must never be called by migrate --show (read-only violation)');
    }),
  };
});

afterAll(() => {
  vi.doUnmock('@internal/config-loader');
  vi.doUnmock('../../src/control-api/client');
  vi.doUnmock('@internal/migration-tools/aggregate');
  vi.doUnmock('../../src/control-api/operations/run-migration');
  vi.resetModules();
});

const EMPTY = 'empty';
const C1 = `${'1'.repeat(64)}`;
const C2 = `${'2'.repeat(64)}`;
const TARGET = 'mock';
const TARGET_FAMILY = 'mock';

const OPS: readonly MigrationPlanOperation[] = [
  { id: 'table.users', label: 'Create table users', operationClass: 'additive' },
];

function contractEnvelope(storageHash: string): Record<string, unknown> {
  return {
    storage: { storageHash, namespaces: {} },
    schemaVersion: '1.0.0',
    target: TARGET,
    targetFamily: TARGET_FAMILY,
  };
}

async function writePkg(
  dir: string,
  base: Omit<MigrationMetadata, 'migrationHash'>,
): Promise<{ dirName: string; migrationHash: string }> {
  const dirName = `20260101_100000_${base.to.slice(7, 13)}`;
  const pkgDir = join(dir, dirName);
  const migrationHash = computeMigrationHash(base, OPS as MigrationPlanOperation[]);
  const metadata: MigrationMetadata = { ...base, migrationHash };
  await writeMigrationPackage(pkgDir, metadata, OPS as MigrationPlanOperation[]);
  return { dirName, migrationHash };
}

const tempDirs: string[] = [];

afterEach(async () => {
  const dirs = tempDirs.splice(0);
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function buildFixture(): Promise<{ cwd: string; appDir: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'cli-migrate-show-'));
  tempDirs.push(cwd);
  const appDir = join(cwd, 'migrations', 'app');
  await mkdir(appDir, { recursive: true });
  // Linear chain: EMPTY → C1 → C2
  await writePkg(appDir, {
    from: EMPTY,
    to: C1,
    providedInvariants: [],
    createdAt: '2026-01-01T10:00:00.000Z',
  });
  await writePkg(appDir, {
    from: C1,
    to: C2,
    providedInvariants: [],
    createdAt: '2026-01-01T10:01:00.000Z',
  });
  await writeFile(join(cwd, 'contract.json'), JSON.stringify(contractEnvelope(C2)));
  return { cwd, appDir };
}

/**
 * Build a fixture where the --to ref carries invariants. Used to verify that
 * planSpacePath feeds resolveRecordedPath the ref's invariants as
 * space.headRef.invariants, not the contract-derived head ref's empty invariants.
 *
 * Graph: EMPTY → C1 → C2 (linear, both migrations provide no invariants).
 * Named ref `prod` = { hash: C2, invariants: ['inv-a'] }.
 *
 * With the old bug: space.headRef.invariants was always [], so required = [].
 * With the fix: space.headRef.invariants is ['inv-a'], so required = ['inv-a'] \ markerInvariants.
 * The resolveRecordedPath call argument differs between the two — this test detects it.
 */
async function buildInvariantFixture(): Promise<{ cwd: string; appDir: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'cli-migrate-show-inv-'));
  tempDirs.push(cwd);
  const appDir = join(cwd, 'migrations', 'app');
  const refsDir = join(appDir, 'refs');
  await mkdir(appDir, { recursive: true });
  await writePkg(appDir, {
    from: EMPTY,
    to: C1,
    providedInvariants: ['inv-a'],
    createdAt: '2026-01-01T10:00:00.000Z',
  });
  await writePkg(appDir, {
    from: C1,
    to: C2,
    providedInvariants: [],
    createdAt: '2026-01-01T10:01:00.000Z',
  });
  await writeFile(join(cwd, 'contract.json'), JSON.stringify(contractEnvelope(C2)));
  // Named ref 'prod' targeting C2 with invariant 'inv-a'.
  await writeRef(refsDir, 'prod', { hash: C2, invariants: ['inv-a'] });
  return { cwd, appDir };
}

function setupConfigMock(): void {
  mocks.loadConfig.mockResolvedValue(
    ok({
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
      driver: { kind: 'driver', create: vi.fn() },
      contract: { output: 'contract.json' },
      migrations: { dir: 'migrations' },
    }),
  );
}

describe('migrate --show (read-only + faithfulness)', () => {
  let consoleOutput: string[];
  let cleanupMocks: () => void;
  const originalCwd = process.cwd();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    cleanupMocks = commandMocks.cleanup;
    setupConfigMock();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupMocks();
  });

  describe('the config sections an offline preview asks for', () => {
    async function runShow(argv: readonly string[]): Promise<readonly string[]> {
      const { cwd } = await buildFixture();
      process.chdir(cwd);
      const { createMigrateCommand } = await import('../../src/commands/migrate');

      try {
        await executeCommand(createMigrateCommand(), [...argv, '--no-color']);
      } catch {
        // The sections are recorded before any planning failure can matter.
      }
      return mocks.loadConfig.mock.calls[0]?.[1] ?? [];
    }

    it('omits driver for an offline --from, which never reads it', async () => {
      expect(await runShow(['--show', '--from', EMPTY])).not.toContain('driver');
    });

    it('requires driver when --from is absent and the live marker is read', async () => {
      expect(await runShow(['--show'])).toContain('driver');
    });

    it('requires driver for --from @db, which resolves against the live marker', async () => {
      expect(await runShow(['--show', '--from', '@db'])).toContain('driver');
    });
  });

  it('read-only: never calls runMigration when --show is passed', async () => {
    const { cwd } = await buildFixture();
    process.chdir(cwd);

    const { createMigrateCommand } = await import('../../src/commands/migrate');

    try {
      await executeCommand(createMigrateCommand(), ['--show', '--from', 'empty', '--no-color']);
    } catch {
      // process.exit on success
    }

    // The mock throws if runMigration is called — if we reach here, it was not called.
    expect(mocks.runMigration).not.toHaveBeenCalled();
  });

  it('faithfulness: resolveRecordedPath is called with the correct inputs (same as migrate apply)', async () => {
    // Basic fixture: linear chain, no ref invariants.
    // Asserts resolveRecordedPath is called with a correctly-assembled currentMarker
    // (null for EMPTY from-state) and the contract-derived target hash.
    const { cwd } = await buildFixture();
    process.chdir(cwd);

    const { createMigrateCommand } = await import('../../src/commands/migrate');

    try {
      await executeCommand(createMigrateCommand(), ['--show', '--from', 'empty', '--no-color']);
    } catch {
      // process.exit on success
    }

    expect(mocks.resolveRecordedPath).toHaveBeenCalled();
    const [firstCall] = mocks.resolveRecordedPath.mock.calls;
    expect(firstCall).toBeDefined();
    const callArg = firstCall![0] as { currentMarker: unknown; space: { headRef: unknown } };
    // From empty — marker should be null (planSpacePath treats EMPTY as no-marker).
    expect(callArg.currentMarker).toBeNull();
    // App space head ref invariants default to [] (synthesised from contract).
    expect((callArg.space.headRef as { invariants: unknown }).invariants).toEqual([]);
  });

  it('faithfulness: --to ref invariants are passed to resolveRecordedPath (not silently dropped)', async () => {
    // This test would have caught the original Bug #2: the show command was ignoring the
    // --to ref's invariants and always using headRef.invariants = [] instead.
    //
    // Fixture: EMPTY → C1 (provides 'inv-a') → C2; named ref 'prod' = { hash: C2, invariants: ['inv-a'] }.
    // With the old bug: space.headRef.invariants = [] (invariants dropped).
    // With the fix:    space.headRef.invariants = ['inv-a'] (ref invariants propagated).
    //
    // On a graph where all paths from EMPTY satisfy 'inv-a' (EMPTY→C1 provides it), the
    // walk still succeeds; what changes is the required set fed to findPathWithDecision.
    // A graph with ONLY a path that does NOT provide 'inv-a' from the current position would
    // return 'unsatisfiable' under the bug but succeed here — making the bug detectable via
    // the call arguments without needing a branching graph topology.
    const { cwd } = await buildInvariantFixture();
    process.chdir(cwd);

    const { createMigrateCommand } = await import('../../src/commands/migrate');

    try {
      await executeCommand(createMigrateCommand(), [
        '--show',
        '--from',
        'empty',
        '--to',
        'prod',
        '--no-color',
      ]);
    } catch {
      // process.exit on success
    }

    expect(getExitCode()).toBe(0);
    expect(mocks.resolveRecordedPath).toHaveBeenCalled();
    const [firstCall] = mocks.resolveRecordedPath.mock.calls;
    expect(firstCall).toBeDefined();
    const callArg = firstCall![0] as { space: { headRef: { hash: string; invariants: unknown } } };
    // The ref 'prod' has invariants: ['inv-a']. planSpacePath must propagate these
    // as space.headRef.invariants. The old bug set headRef.invariants = [] here.
    expect(callArg.space.headRef.invariants).toEqual(['inv-a']);
    // And the target hash must be C2 (the ref's hash).
    expect(callArg.space.headRef.hash).toBe(C2);
  });

  it('prints the ordered list of migrations that will run', async () => {
    const { cwd } = await buildFixture();
    process.chdir(cwd);

    const { createMigrateCommand } = await import('../../src/commands/migrate');

    try {
      await executeCommand(createMigrateCommand(), ['--show', '--from', 'empty', '--no-color']);
    } catch {
      // process.exit on success
    }

    expect(getExitCode()).toBe(0);
    const output = stripAnsi(consoleOutput.join('\n'));
    // Should show both migrations in order (EMPTY → C1 → C2)
    expect(output).toContain('20260101_100000_111111');
    expect(output).toContain('20260101_100000_222222');
    expect(output).toContain('The following');
  });

  it('shows "nothing to run" when already at target', async () => {
    const { cwd } = await buildFixture();
    process.chdir(cwd);

    const { createMigrateCommand } = await import('../../src/commands/migrate');

    try {
      // From C2 to C2 — already at target
      await executeCommand(createMigrateCommand(), [
        '--show',
        '--from',
        C2.slice(7, 13),
        '--no-color',
      ]);
    } catch {
      // process.exit on success
    }

    expect(getExitCode()).toBe(0);
    const output = stripAnsi(consoleOutput.join('\n'));
    expect(output).toMatch(/nothing to run|already up to date|0 migrations/i);
  });

  it('errors gracefully when no path exists from-state → target', async () => {
    const { cwd } = await buildFixture();
    process.chdir(cwd);

    const { createMigrateCommand } = await import('../../src/commands/migrate');

    // From C2 to C1 — backwards, no path
    try {
      await executeCommand(createMigrateCommand(), [
        '--show',
        '--from',
        C2.slice(7, 13),
        '--to',
        C1.slice(7, 13),
        '--no-color',
      ]);
    } catch {
      // process.exit on failure
    }

    expect(getExitCode()).not.toBe(0);
  });

  it('requires --db when --from is omitted (live marker mode)', async () => {
    const { cwd } = await buildFixture();
    process.chdir(cwd);

    const { createMigrateCommand } = await import('../../src/commands/migrate');

    try {
      // No --from, no --db — should error requiring a DB connection
      await executeCommand(createMigrateCommand(), ['--show', '--no-color']);
    } catch {
      // process.exit on failure
    }

    expect(getExitCode()).not.toBe(0);
  });

  it('@db --from without --db connection returns a structured error', async () => {
    const { cwd } = await buildFixture();
    process.chdir(cwd);

    const { createMigrateCommand } = await import('../../src/commands/migrate');

    try {
      await executeCommand(createMigrateCommand(), ['--show', '--from', '@db', '--json']);
    } catch {
      // process.exit on failure
    }

    expect(getExitCode()).not.toBe(0);
    const jsonLine = consoleOutput.find((l) => l.trimStart().startsWith('{'));
    expect(jsonLine).toBeDefined();
    const envelope = JSON.parse(jsonLine!) as { code?: string; message?: string };
    // Should be a structured error — either connection-required or not-found
    expect(envelope.code).toBeTruthy();
  });

  it('graph visualization: DB one migration behind target (worked example snapshot)', async () => {
    // Fixture: linear chain EMPTY → C1 → C2; from-state = C1 (DB one migration behind).
    // Expected: C2 (@contract) at top, on-path edge (C1→C2) green, off-path edge (EMPTY→C1)
    // fully drawn (dim grey — name visible, not omitted).
    const { cwd } = await buildFixture();
    process.chdir(cwd);

    const { createMigrateCommand } = await import('../../src/commands/migrate');

    try {
      // from=C1 (DB one migration behind) to C2 (the current contract)
      await executeCommand(createMigrateCommand(), [
        '--show',
        '--from',
        C1.slice(7, 13), // hex prefix for C1
        '--no-color',
      ]);
    } catch {
      // process.exit on success
    }

    expect(getExitCode()).toBe(0);
    const output = stripAnsi(consoleOutput.join('\n'));

    // Graph should be present in the output.
    // C2 node (working contract) should appear with @contract marker.
    expect(output).toContain(C2.slice(7, 13));
    expect(output).toContain('@contract');
    // C1 node (from-state) should appear.
    expect(output).toContain(C1.slice(7, 13));
    // The on-path migration (C1→C2) dirName should appear in the graph.
    expect(output).toContain('20260101_100000_222222');
    // The off-path migration (EMPTY→C1) dirName IS shown — fully drawn in grey (not omitted).
    expect(output).toContain('20260101_100000_111111');
    // The consolidated header must appear (no separate "N migrations will run" + "Will run, in order:").
    expect(output).toContain('The following 1 migration will run:');
    expect(output).not.toContain('Will run, in order:');
    // The ordered list uses graph row format (from → to hash columns), not "1. name (from → to)".
    expect(output).toContain(`${C1.slice(7, 14)} → ${C2.slice(7, 14)}`);
    // No Clack │ prefix on any list line.
    const listLines = output
      .split('\n')
      .filter((l) => l.includes('20260101_100000_222222') && !l.includes('○') && !l.includes('│'));
    expect(listLines.length).toBeGreaterThan(0);
  });

  it('@contract marks the working contract (not the --to target) even when --to < working contract', async () => {
    // Fixture: EMPTY → C1 → C2; working contract = C2 (from contract.json).
    // Run --show --from EMPTY --to C1: targetHash = C1, contractHash = C2.
    // BUG 1 was: renderer received contractHash = targetHash = C1, marking C1 as @contract.
    // Fix: renderer receives contractHash = working contract = C2.
    // Expected: @contract marks C2 (the working contract), NOT C1 (the --to target).
    const { cwd } = await buildFixture();
    process.chdir(cwd);

    const { createMigrateCommand } = await import('../../src/commands/migrate');

    try {
      await executeCommand(createMigrateCommand(), [
        '--show',
        '--from',
        EMPTY,
        '--to',
        C1.slice(7, 13),
        '--no-color',
      ]);
    } catch {}

    expect(getExitCode()).toBe(0);
    const output = stripAnsi(consoleOutput.join('\n'));

    // @contract must appear exactly once and be on the C2 node (the working contract).
    const graphSection = output.split('The following')[0] ?? output;
    const contractMarkerCount = (graphSection.match(/@contract/g) ?? []).length;
    expect(contractMarkerCount).toBe(1);
    const contractLine = graphSection.split('\n').find((l) => l.includes('@contract'));
    expect(contractLine).toBeDefined();
    // @contract marks C2 (working contract), not C1 (the --to target).
    expect(contractLine).toContain(C2.slice(7, 13));
    expect(contractLine).not.toContain(C1.slice(7, 13));
  });

  it('@contract does not appear in extension spaces', async () => {
    // Build a fixture with two spaces: app and a pgvector extension.
    // The app space has EMPTY→C1→C2; the extension has its own graph.
    // @contract must appear only in the app space section, not in the extension section.
    const cwd = await mkdtemp(join(tmpdir(), 'cli-migrate-show-ext-'));
    tempDirs.push(cwd);

    const EXT_C1 = `${'e'.repeat(64)}`;
    const extAppDir = join(cwd, 'migrations', 'app');
    const extVectorDir = join(cwd, 'migrations', 'pgvector');
    await mkdir(extAppDir, { recursive: true });
    await mkdir(extVectorDir, { recursive: true });

    // App space: EMPTY → C1 → C2
    await writePkg(extAppDir, {
      from: EMPTY,
      to: C1,
      providedInvariants: [],
      createdAt: '2026-01-01T10:00:00.000Z',
    });
    await writePkg(extAppDir, {
      from: C1,
      to: C2,
      providedInvariants: [],
      createdAt: '2026-01-01T10:01:00.000Z',
    });

    // Extension space (pgvector): EMPTY → EXT_C1 (standalone graph, head = EXT_C1)
    const extHash = computeMigrationHash(
      { from: EMPTY, to: EXT_C1, providedInvariants: [], createdAt: '2026-01-01T09:00:00.000Z' },
      OPS as MigrationPlanOperation[],
    );
    const extDirName = `20260101_090000_${EXT_C1.slice(7, 13)}`;
    const extPkgDir = join(extVectorDir, extDirName);
    const extMetadata = {
      from: EMPTY,
      to: EXT_C1,
      providedInvariants: [],
      createdAt: '2026-01-01T09:00:00.000Z',
      migrationHash: extHash,
    };
    await writeMigrationPackage(extPkgDir, extMetadata, OPS as MigrationPlanOperation[]);
    // Write head ref for the extension space so aggregate can load it.
    await writeRef(join(extVectorDir, 'refs'), 'head', { hash: EXT_C1, invariants: [] });
    // Write the extension space's contract into the snapshot store, keyed
    // by the head ref hash (aggregate resolves it from there).
    await writeContractSnapshot(join(cwd, 'migrations'), EXT_C1, {
      contractJson: contractEnvelope(EXT_C1),
      contractDts: 'export type Contract = unknown;\n',
    });

    await writeFile(join(cwd, 'contract.json'), JSON.stringify(contractEnvelope(C2)));

    // Configure with the pgvector extension pack declared.
    mocks.loadConfig.mockResolvedValue(
      ok({
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
        driver: { kind: 'driver', create: vi.fn() },
        contract: { output: 'contract.json' },
        migrations: { dir: 'migrations' },
        extensions: [
          {
            id: 'pgvector',
            targetId: TARGET,
            // contractSpace must be present (non-undefined) for toDeclaredExtensionsFromRaw
            // to recognise this as a contract-space extension. The aggregate loader
            // reads the actual contract from disk (migrations/pgvector/), not from here.
            contractSpace: {
              contractJson: contractEnvelope(EXT_C1),
              headRef: { hash: EXT_C1, invariants: [] },
              migrations: [],
            },
          },
        ],
      }),
    );

    process.chdir(cwd);
    const { createMigrateCommand } = await import('../../src/commands/migrate');

    let caughtError: unknown;
    try {
      await executeCommand(createMigrateCommand(), ['--show', '--from', EMPTY, '--no-color']);
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError, 'command threw unexpectedly').toBeUndefined();
    expect(getExitCode()).toBe(0);
    const output = stripAnsi(consoleOutput.join('\n'));

    // Multi-space output: there should be two space headings.
    expect(output).toContain('app:');
    expect(output).toContain('pgvector:');

    // @contract must appear in the app section, not in the pgvector section.
    const appSection = output.split('pgvector:')[0] ?? '';
    const pgvectorSection = output.split('pgvector:')[1] ?? '';
    expect(appSection).toContain('@contract');
    expect(pgvectorSection).not.toContain('@contract');
  });

  it('--from/--to app-space markers do not leak into extension spaces (BUG 1)', async () => {
    // Repro: with --from <app-hash> --to <app-hash>, extension spaces must NOT receive the
    // app --from hash as their marker. If they did, planSpacePath would try to walk
    // extension-graph from that app hash (which doesn't exist there) and return 'unreachable',
    // producing "No migration path from 76c1bd5 to ... in space 'pgvector'".
    //
    // Expected behaviour: extension spaces ignore --from and plan from their own live marker
    // (null / greenfield in offline mode) → their own head — exactly as executeMigrate does.
    // The extension migration (EMPTY → EXT_C1) must appear in the planned migrations list,
    // confirming it was planned from greenfield and NOT from the app's --from hash.
    const cwd = await mkdtemp(join(tmpdir(), 'cli-migrate-show-leak-'));
    tempDirs.push(cwd);

    const EXT_C1 = `${'f'.repeat(64)}`;
    const appMigrationsDir = join(cwd, 'migrations', 'app');
    const extMigrationsDir = join(cwd, 'migrations', 'pgvector');
    await mkdir(appMigrationsDir, { recursive: true });
    await mkdir(extMigrationsDir, { recursive: true });

    // App space: EMPTY → C1 → C2. We will pass --from C1 --to C2 (one app migration to run).
    const appMig1 = await writePkg(appMigrationsDir, {
      from: EMPTY,
      to: C1,
      providedInvariants: [],
      createdAt: '2026-01-01T10:00:00.000Z',
    });
    await writePkg(appMigrationsDir, {
      from: C1,
      to: C2,
      providedInvariants: [],
      createdAt: '2026-01-01T10:01:00.000Z',
    });

    // Extension space (pgvector): EMPTY → EXT_C1. Its own standalone graph; head = EXT_C1.
    // The extension marker is absent (offline mode), so planSpacePath should treat it as
    // greenfield (null) and plan EMPTY → EXT_C1.
    const extMigHash = computeMigrationHash(
      { from: EMPTY, to: EXT_C1, providedInvariants: [], createdAt: '2026-01-01T09:00:00.000Z' },
      OPS as MigrationPlanOperation[],
    );
    const extDirName = `20260101_090000_${EXT_C1.slice(7, 13)}`;
    await writeMigrationPackage(
      join(extMigrationsDir, extDirName),
      {
        from: EMPTY,
        to: EXT_C1,
        providedInvariants: [],
        createdAt: '2026-01-01T09:00:00.000Z',
        migrationHash: extMigHash,
      },
      OPS as MigrationPlanOperation[],
    );
    await writeRef(join(extMigrationsDir, 'refs'), 'head', { hash: EXT_C1, invariants: [] });
    await writeContractSnapshot(join(cwd, 'migrations'), EXT_C1, {
      contractJson: contractEnvelope(EXT_C1),
      contractDts: 'export type Contract = unknown;\n',
    });

    await writeFile(join(cwd, 'contract.json'), JSON.stringify(contractEnvelope(C2)));

    mocks.loadConfig.mockResolvedValue(
      ok({
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
        driver: { kind: 'driver', create: vi.fn() },
        contract: { output: 'contract.json' },
        migrations: { dir: 'migrations' },
        extensions: [
          {
            id: 'pgvector',
            targetId: TARGET,
            contractSpace: {
              contractJson: contractEnvelope(EXT_C1),
              headRef: { hash: EXT_C1, invariants: [] },
              migrations: [],
            },
          },
        ],
      }),
    );

    process.chdir(cwd);
    const { createMigrateCommand } = await import('../../src/commands/migrate');

    let caughtError: unknown;
    try {
      // Pass --from C1 (app hash) --to C2 (app target). Before the fix, the C1 hash was
      // also applied to the pgvector space, causing "no path in space 'pgvector'" error.
      await executeCommand(createMigrateCommand(), [
        '--show',
        '--from',
        C1.slice(7, 13),
        '--to',
        C2.slice(7, 13),
        '--no-color',
      ]);
    } catch (e) {
      caughtError = e;
    }

    // Must not throw — previously would throw "no path in space 'pgvector'".
    expect(caughtError, 'command threw unexpectedly').toBeUndefined();
    expect(getExitCode()).toBe(0);

    const output = stripAnsi(consoleOutput.join('\n'));

    // The extension migration (EMPTY → EXT_C1) must appear in the planned ordered list,
    // proving the extension was planned from greenfield (null marker) → its head,
    // NOT from the app's --from hash which would have caused "no path" error.
    expect(output).toContain(extDirName);

    // Split output into graph section and ordered-list section.
    // The consolidated header is "The following N migration(s) will run:" — split after it.
    const orderedListSection = output.split(/The following \d+ migrations? will run:/)[1] ?? '';

    // The app migration C1 → C2 must appear in the ordered list.
    expect(orderedListSection).toContain('20260101_100000_222222');

    // The app's first migration (EMPTY → C1) must NOT appear in the ordered list —
    // --from C1 means we start from C1, so that migration is already applied.
    // (It may appear in the graph as an off-path edge — that's expected.)
    expect(orderedListSection).not.toContain(appMig1.dirName);
  });

  it('canonical schedule order: extension migrations appear before app migrations in the ordered run list', async () => {
    // Regression guard for the ordering bug: the runner applies extensions first
    // (alphabetically by spaceId), then the app. The ordered run list must
    // reflect that same sequence — not app-first.
    //
    // Fixture: two spaces.
    //   pgvector: EMPTY → EXT_C1 (one migration to run, extension installs first).
    //   app:      EMPTY → C1 → C2 (two app migrations to run after the extension).
    //
    // Expected ordered list: extension migration first, then the two app migrations.
    const cwd = await mkdtemp(join(tmpdir(), 'cli-migrate-show-order-'));
    tempDirs.push(cwd);

    const EXT_C1 = `${'a'.repeat(64)}`;
    const appMigrationsDir = join(cwd, 'migrations', 'app');
    const extMigrationsDir = join(cwd, 'migrations', 'pgvector');
    await mkdir(appMigrationsDir, { recursive: true });
    await mkdir(extMigrationsDir, { recursive: true });

    // App space: EMPTY → C1 → C2.
    const appMig1 = await writePkg(appMigrationsDir, {
      from: EMPTY,
      to: C1,
      providedInvariants: [],
      createdAt: '2026-06-05T12:00:00.000Z',
    });
    const appMig2 = await writePkg(appMigrationsDir, {
      from: C1,
      to: C2,
      providedInvariants: [],
      createdAt: '2026-06-05T12:01:00.000Z',
    });

    // Extension space (pgvector): EMPTY → EXT_C1.
    const extMigHash = computeMigrationHash(
      { from: EMPTY, to: EXT_C1, providedInvariants: [], createdAt: '2026-06-05T11:00:00.000Z' },
      OPS as MigrationPlanOperation[],
    );
    const extDirName = '20260601T0000_install_vector_extension';
    await writeMigrationPackage(
      join(extMigrationsDir, extDirName),
      {
        from: EMPTY,
        to: EXT_C1,
        providedInvariants: [],
        createdAt: '2026-06-05T11:00:00.000Z',
        migrationHash: extMigHash,
      },
      OPS as MigrationPlanOperation[],
    );
    await writeRef(join(extMigrationsDir, 'refs'), 'head', { hash: EXT_C1, invariants: [] });
    await writeContractSnapshot(join(cwd, 'migrations'), EXT_C1, {
      contractJson: contractEnvelope(EXT_C1),
      contractDts: 'export type Contract = unknown;\n',
    });

    await writeFile(join(cwd, 'contract.json'), JSON.stringify(contractEnvelope(C2)));

    mocks.loadConfig.mockResolvedValue(
      ok({
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
        driver: { kind: 'driver', create: vi.fn() },
        contract: { output: 'contract.json' },
        migrations: { dir: 'migrations' },
        extensions: [
          {
            id: 'pgvector',
            targetId: TARGET,
            contractSpace: {
              contractJson: contractEnvelope(EXT_C1),
              headRef: { hash: EXT_C1, invariants: [] },
              migrations: [],
            },
          },
        ],
      }),
    );

    process.chdir(cwd);
    const { createMigrateCommand } = await import('../../src/commands/migrate');

    let caughtError: unknown;
    try {
      await executeCommand(createMigrateCommand(), ['--show', '--from', EMPTY, '--no-color']);
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError, 'command threw unexpectedly').toBeUndefined();
    expect(getExitCode()).toBe(0);

    const output = stripAnsi(consoleOutput.join('\n'));
    const orderedListSection = output.split(/The following \d+ migrations? will run:/)[1] ?? '';

    // Extension migration and both app migrations must appear.
    expect(orderedListSection).toContain(extDirName);
    expect(orderedListSection).toContain(appMig1.dirName);
    expect(orderedListSection).toContain(appMig2.dirName);

    // The extension migration must appear BEFORE the app migrations.
    // Canonical runner order: extensions alphabetically first, then app.
    const extPos = orderedListSection.indexOf(extDirName);
    const app1Pos = orderedListSection.indexOf(appMig1.dirName);
    const app2Pos = orderedListSection.indexOf(appMig2.dirName);
    expect(extPos).toBeLessThan(app1Pos);
    expect(extPos).toBeLessThan(app2Pos);
  });
});
