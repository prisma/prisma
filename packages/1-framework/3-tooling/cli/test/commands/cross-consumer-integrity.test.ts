import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { ok } from '@internal/utils/result';
import { timeouts } from '@repo/test-utils';
import { join } from 'pathe';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeCommand, getExitCode, setupCommandMocks } from '../utils/test-helpers';

/**
 * Cross-consumer integrity matrix.
 *
 * A single on-disk project is planted with three independent faults — a
 * `from === to` self-edge (no data op), a hash-mismatched package, and an
 * orphan contract-space directory no extension declares — and every
 * contract-space consumer is driven against it. The assertions pin the
 * per-command-class behaviour the tolerant model promises (project spec §
 * behaviour matrix):
 *
 *   - **Read / render** (`migration show`, `migration status` render path):
 *     tolerate-and-render — the self-edge is shown, the command does not
 *     crash, exit 0.
 *   - **`migration check`** (report-all): renders the FULL violation set in
 *     one invocation — hash-mismatch (`MIGRATION.CHECK_HASH_MISMATCH`), self-edge
 *     (`-007`), and orphan-dir (`-008`) all surface together.
 *   - **`migration status` pin**: refuses with the `MIGRATION.CONTRACT_SPACE_VIOLATION` integrity
 *     envelope on the package-corruption kinds (hash mismatch), while
 *     tolerating the self-edge and other non-corruption drift silently.
 *   - **apply** (`migrate`): refuses with the contract-space integrity
 *     envelope. Precedence is exercised with two fixtures — the all-three
 *     fixture refuses `MIGRATION.CONTRACT_SPACE_LAYOUT_VIOLATION` (orphan / layout drift wins), and an
 *     integrity-only fixture (hash-mismatch, no orphan, extensions declared
 *     correctly) refuses `MIGRATION.CONTRACT_SPACE_VIOLATION` with `meta.violations[]`.
 *
 * `migrate`'s gate is a pure offline check that fires before
 * `client.connect()`, so the stub driver is never reached — the refusal is
 * the gate's, not a connection error's. `db verify` shares the identical
 * `mapIntegrityViolations` gate but runs it post-connect (it needs a live
 * marker first), so its `5001`/`5002` surface is pinned by the loader unit
 * test (`contract-space-aggregate-loader.ac15`) and the real-DB
 * `cli.db-verify.aggregate-schema` suite rather than re-driven offline here.
 *
 * `loadConfig` is mocked (a real `prisma-next.config.ts` would pull in
 * TypeScript transpilation + a target adapter); everything downstream runs
 * against the real on-disk fixture.
 */

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfig,
}));

const TARGET = 'mock';
const TARGET_FAMILY = 'mock';
const SCHEMA_VERSION = '1.0.0';
const CREATED_AT = '2026-02-25T14:30:00.000Z';

const HASH_A = `${'a'.repeat(64)}`;
const HASH_B = `${'b'.repeat(64)}`;
const HASH_C = `${'c'.repeat(64)}`;

const ADDITIVE_OPS: readonly MigrationPlanOperation[] = [
  { id: 'table.users', label: 'Create table users', operationClass: 'additive' },
];

const TAMPERED_OPS: readonly MigrationPlanOperation[] = [
  ...ADDITIVE_OPS,
  { id: 'tamper.synthetic', label: 'Synthetic tamper op', operationClass: 'additive' },
];

function baseConfig(): Record<string, unknown> {
  // Pass-through `deserializeContract` keeps the contract read crossing the
  // family seam (TML-2536's invariant) while letting the skeletal contract
  // (`storage.storageHash` only) drive the post-read integrity gate.
  return {
    family: {
      familyId: TARGET_FAMILY,
      create: vi.fn().mockReturnValue({
        deserializeContract: (json: unknown) => json,
        readMarker: vi.fn().mockResolvedValue(null),
        readAllMarkers: vi.fn().mockResolvedValue(new Map()),
        readLedger: vi.fn().mockResolvedValue([]),
      }),
    },
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
    db: { connection: 'postgres://localhost/cross-consumer-test' },
    contract: { output: 'src/prisma/contract.json' },
  };
}

function setupConfigMock(): void {
  mocks.loadConfig.mockResolvedValue(ok(baseConfig()));
}

/**
 * Config that declares a contract-space extension. `contractSpace` must be
 * a defined own property for `toDeclaredExtensionsFromRaw` to surface the
 * entry; the aggregate loader reads the extension's contract from disk, not
 * from this descriptor, so the in-descriptor fields are intentionally
 * skeletal.
 */
function setupConfigMockWithExtension(extId: string): void {
  mocks.loadConfig.mockResolvedValue(
    ok({
      ...baseConfig(),
      extensions: [
        {
          id: extId,
          targetId: TARGET,
          contractSpace: {
            contractJson: {},
            headRef: { hash: HASH_C, invariants: [] },
            migrations: [],
          },
        },
      ],
    }),
  );
}

interface PackageSpec {
  readonly dirName: string;
  readonly from: string | null;
  readonly to: string;
  readonly ops: readonly MigrationPlanOperation[];
  /** When set, `ops.json` is overwritten after attestation to force a hash mismatch. */
  readonly tamperedOps?: readonly MigrationPlanOperation[];
}

async function writePackage(spaceDir: string, spec: PackageSpec): Promise<void> {
  const metadataBase: Omit<MigrationMetadata, 'migrationHash'> = {
    from: spec.from,
    to: spec.to,
    providedInvariants: [],
    createdAt: CREATED_AT,
  };
  const metadata: MigrationMetadata = {
    ...metadataBase,
    migrationHash: computeMigrationHash(metadataBase, spec.ops),
  };
  const packageDir = join(spaceDir, spec.dirName);
  await writeMigrationPackage(packageDir, metadata, spec.ops);
  if (spec.tamperedOps !== undefined) {
    await writeFile(join(packageDir, 'ops.json'), JSON.stringify(spec.tamperedOps, null, 2));
  }
}

async function writeContract(cwd: string, storageHash: string): Promise<void> {
  const contractDir = join(cwd, 'src', 'prisma');
  await mkdir(contractDir, { recursive: true });
  await writeFile(
    join(contractDir, 'contract.json'),
    JSON.stringify({
      storage: { storageHash, namespaces: {} },
      schemaVersion: SCHEMA_VERSION,
      target: TARGET,
      targetFamily: TARGET_FAMILY,
    }),
  );
}

/**
 * Write a self-consistent extension space dir that is an orphan only
 * because no extension declares it: a clean package (`null -> hash`), a
 * head ref pointing at that hash, and a valid contract. This isolates the
 * `orphanSpaceDir` signal from the incidental `headRefMissing` /
 * `contractUnreadable` an empty dir would also raise.
 */
async function writeCleanOrphanSpace(cwd: string, spaceId: string, hash: string): Promise<void> {
  const spaceDir = join(cwd, 'migrations', spaceId);
  await writePackage(spaceDir, {
    dirName: '00001_orphan_base',
    from: null,
    to: hash,
    ops: ADDITIVE_OPS,
  });
  await mkdir(join(spaceDir, 'refs'), { recursive: true });
  await writeFile(
    join(spaceDir, 'refs', 'head.json'),
    `${JSON.stringify({ hash, invariants: [] }, null, 2)}\n`,
  );
  await writeFile(
    join(spaceDir, 'contract.json'),
    JSON.stringify({
      storage: { storageHash: hash, namespaces: {} },
      schemaVersion: SCHEMA_VERSION,
      target: TARGET,
      targetFamily: TARGET_FAMILY,
    }),
  );
}

interface Fixture {
  readonly cwd: string;
  readonly selfEdgeRelDir: string;
}

/**
 * All-three fixture: a self-edge (`A -> A`, no data op), a hash-mismatched
 * package (`A -> B`, ops tampered post-attestation), and a clean orphan
 * space dir (`orphan_ext`). App head is `B`.
 */
async function setupAllThreeFixture(): Promise<Fixture> {
  const cwd = await mkdtemp(join(tmpdir(), 'cross-consumer-all3-'));
  const appDir = join(cwd, 'migrations', 'app');
  await mkdir(appDir, { recursive: true });

  await writePackage(appDir, { dirName: '00001_base', from: null, to: HASH_A, ops: ADDITIVE_OPS });
  await writePackage(appDir, { dirName: '00002_selfedge', from: HASH_A, to: HASH_A, ops: [] });
  await writePackage(appDir, {
    dirName: '00003_tamper',
    from: HASH_A,
    to: HASH_B,
    ops: ADDITIVE_OPS,
    tamperedOps: TAMPERED_OPS,
  });

  await writeCleanOrphanSpace(cwd, 'orphan_ext', HASH_C);
  await writeContract(cwd, HASH_B);

  return { cwd, selfEdgeRelDir: join('migrations', 'app', '00002_selfedge') };
}

/**
 * Self-edge-only fixture: a base package plus a `A -> A` self-edge, no
 * tamper and no orphan. App head is `A`. Read / render commands must
 * tolerate this and render.
 */
async function setupSelfEdgeFixture(): Promise<Fixture> {
  const cwd = await mkdtemp(join(tmpdir(), 'cross-consumer-selfedge-'));
  const appDir = join(cwd, 'migrations', 'app');
  await mkdir(appDir, { recursive: true });

  await writePackage(appDir, { dirName: '00001_base', from: null, to: HASH_A, ops: ADDITIVE_OPS });
  await writePackage(appDir, { dirName: '00002_selfedge', from: HASH_A, to: HASH_A, ops: [] });

  await writeContract(cwd, HASH_A);

  return { cwd, selfEdgeRelDir: join('migrations', 'app', '00002_selfedge') };
}

/**
 * Integrity-only fixture: a hash-mismatched package, no orphan, no
 * self-edge, no declared extensions. App head is `B`. apply must refuse
 * `MIGRATION.CONTRACT_SPACE_VIOLATION` (no layout drift to take precedence).
 */
async function setupIntegrityOnlyFixture(): Promise<Fixture> {
  const cwd = await mkdtemp(join(tmpdir(), 'cross-consumer-integrity-'));
  const appDir = join(cwd, 'migrations', 'app');
  await mkdir(appDir, { recursive: true });

  await writePackage(appDir, { dirName: '00001_base', from: null, to: HASH_A, ops: ADDITIVE_OPS });
  await writePackage(appDir, {
    dirName: '00002_tamper',
    from: HASH_A,
    to: HASH_B,
    ops: ADDITIVE_OPS,
    tamperedOps: TAMPERED_OPS,
  });

  await writeContract(cwd, HASH_B);

  return { cwd, selfEdgeRelDir: join('migrations', 'app', '00001_base') };
}

/**
 * Extension-space corruption fixture: a clean app space plus a *declared*
 * extension (`ext_a`) carrying a hash-mismatched package. Declaring the
 * extension (and giving it a valid, target-matching contract + head ref)
 * isolates the `hashMismatch` signal — no `orphanSpaceDir`,
 * `declaredButUnmigrated`, or `targetMismatch` noise — so the only fault
 * `check` can report for the space is the corruption. `check`'s legacy
 * on-disk pass reads the app space only, so this fault is reportable only
 * through the aggregate fold.
 */
async function setupExtSpaceCorruptionFixture(): Promise<{ cwd: string; extId: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'cross-consumer-extcorrupt-'));
  const extId = 'ext_a';

  const appDir = join(cwd, 'migrations', 'app');
  await mkdir(appDir, { recursive: true });
  await writePackage(appDir, { dirName: '00001_base', from: null, to: HASH_A, ops: ADDITIVE_OPS });
  await writeContract(cwd, HASH_A);

  const extDir = join(cwd, 'migrations', extId);
  await writePackage(extDir, { dirName: '00001_base', from: null, to: HASH_B, ops: ADDITIVE_OPS });
  await writePackage(extDir, {
    dirName: '00002_tamper',
    from: HASH_B,
    to: HASH_C,
    ops: ADDITIVE_OPS,
    tamperedOps: TAMPERED_OPS,
  });
  await mkdir(join(extDir, 'refs'), { recursive: true });
  await writeFile(
    join(extDir, 'refs', 'head.json'),
    `${JSON.stringify({ hash: HASH_C, invariants: [] }, null, 2)}\n`,
  );
  await writeFile(
    join(extDir, 'contract.json'),
    JSON.stringify({
      storage: { storageHash: HASH_C, namespaces: {} },
      schemaVersion: SCHEMA_VERSION,
      target: TARGET,
      targetFamily: TARGET_FAMILY,
    }),
  );

  return { cwd, extId };
}

interface CliErrorEnvelope {
  readonly summary: string;
  readonly code: string;
  readonly meta?: { readonly violations?: ReadonlyArray<Record<string, unknown>> };
}

interface CheckEnvelope {
  readonly ok: boolean;
  readonly failures?: ReadonlyArray<{ readonly code: string; readonly where: string }>;
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

function firstJsonLine<T>(consoleOutput: readonly string[]): T {
  const line = consoleOutput.find((l) => l.trimStart().startsWith('{'));
  if (!line) {
    throw new Error(`Expected a JSON object on stdout; got:\n${consoleOutput.join('\n')}`);
  }
  return JSON.parse(line) as T;
}

describe('cross-consumer contract-space integrity matrix', () => {
  let consoleOutput: string[];
  let cleanupMocks: () => void;
  const originalCwd = process.cwd();
  let tempDirs: string[];

  beforeEach(() => {
    vi.resetModules();
    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
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
    // Repo-wide vitest runs with `isolate: false`, so the `vi.mock` leaks
    // into the next file in the same worker; unmock to restore it.
    vi.doUnmock('@internal/config-loader');
    vi.resetModules();
  });

  it(
    'migration check reports all three violations at once (hash-mismatch + self-edge + orphan-dir)',
    async () => {
      const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
      const fixture = await setupAllThreeFixture();
      tempDirs.push(fixture.cwd);
      process.chdir(fixture.cwd);

      await runAndCaptureExit(() => executeCommand(createMigrationCheckCommand(), ['--json']));
      const envelope = firstJsonLine<CheckEnvelope>(consoleOutput);

      expect(envelope.ok).toBe(false);
      const codes = (envelope.failures ?? []).map((f) => f.code);
      expect(codes).toContain('MIGRATION.CHECK_HASH_MISMATCH'); // hash mismatch
      expect(codes).toContain('MIGRATION.CHECK_NOOP_SELF_EDGE'); // self-edge (sameSourceAndTarget)
      expect(codes).toContain('MIGRATION.CHECK_ORPHAN_SPACE_DIR'); // orphan space dir

      // The app-space hash mismatch is reported exactly once via checkIntegrity().
      expect(codes.filter((c) => c === 'MIGRATION.CHECK_HASH_MISMATCH')).toHaveLength(1);
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'migration check reports extension-space package corruption the app-only legacy pass cannot see',
    async () => {
      const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
      const fixture = await setupExtSpaceCorruptionFixture();
      tempDirs.push(fixture.cwd);
      setupConfigMockWithExtension(fixture.extId);
      process.chdir(fixture.cwd);

      await runAndCaptureExit(() => executeCommand(createMigrationCheckCommand(), ['--json']));
      const envelope = firstJsonLine<CheckEnvelope>(consoleOutput);

      // checkIntegrity() sees every space; the extension hash mismatch surfaces
      // through the shared mapper (no app-only legacy pass):
      // unreported. It now surfaces, located in the extension space.
      expect(envelope.ok).toBe(false);
      const hashFailures = (envelope.failures ?? []).filter(
        (f) => f.code === 'MIGRATION.CHECK_HASH_MISMATCH',
      );
      expect(hashFailures).toHaveLength(1);
      expect(hashFailures[0]?.where).toContain(fixture.extId);
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'migrate refuses the all-three fixture with MIGRATION.CONTRACT_SPACE_LAYOUT_VIOLATION (orphan/layout precedence)',
    async () => {
      const { createMigrateCommand } = await import('../../src/commands/migrate');
      const fixture = await setupAllThreeFixture();
      tempDirs.push(fixture.cwd);
      process.chdir(fixture.cwd);

      const exitCode = await runAndCaptureExit(() =>
        executeCommand(createMigrateCommand(), ['--json']),
      );
      const envelope = firstJsonLine<CliErrorEnvelope>(consoleOutput);

      expect(exitCode).not.toBe(0);
      expect(envelope.code).toBe('MIGRATION.CONTRACT_SPACE_LAYOUT_VIOLATION');
      const violations = envelope.meta?.violations ?? [];
      expect(violations.some((v) => v['kind'] === 'orphanSpaceDir')).toBe(true);
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'migrate refuses the integrity-only fixture with MIGRATION.CONTRACT_SPACE_VIOLATION + meta.violations',
    async () => {
      const { createMigrateCommand } = await import('../../src/commands/migrate');
      const fixture = await setupIntegrityOnlyFixture();
      tempDirs.push(fixture.cwd);
      process.chdir(fixture.cwd);

      const exitCode = await runAndCaptureExit(() =>
        executeCommand(createMigrateCommand(), ['--json']),
      );
      const envelope = firstJsonLine<CliErrorEnvelope>(consoleOutput);

      expect(exitCode).not.toBe(0);
      expect(envelope.code).toBe('MIGRATION.CONTRACT_SPACE_VIOLATION');
      const violations = envelope.meta?.violations ?? [];
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v['kind'] === 'hashMismatch' && v['spaceId'] === 'app')).toBe(
        true,
      );
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'migration status pin refuses MIGRATION.CONTRACT_SPACE_VIOLATION on package corruption (hash mismatch)',
    async () => {
      const { createMigrationStatusCommand } = await import('../../src/commands/migration-status');
      const fixture = await setupAllThreeFixture();
      tempDirs.push(fixture.cwd);
      process.chdir(fixture.cwd);

      const exitCode = await runAndCaptureExit(() =>
        executeCommand(createMigrationStatusCommand(), ['--json']),
      );
      const envelope = firstJsonLine<CliErrorEnvelope>(consoleOutput);

      expect(exitCode).not.toBe(0);
      expect(envelope.code).toBe('MIGRATION.CONTRACT_SPACE_VIOLATION');
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'migration status render path tolerates a self-edge and renders (exit 0, no refusal)',
    async () => {
      const { createMigrationStatusCommand } = await import('../../src/commands/migration-status');
      const fixture = await setupSelfEdgeFixture();
      tempDirs.push(fixture.cwd);
      process.chdir(fixture.cwd);

      const exitCode = await runAndCaptureExit(() =>
        executeCommand(createMigrationStatusCommand(), ['--json']),
      );
      const envelope = firstJsonLine<{ ok?: boolean; code?: string }>(consoleOutput);

      expect(exitCode).toBe(0);
      expect(envelope.ok).toBe(true);
      expect(envelope.code).toBeUndefined();
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'migration show renders a self-edge package and tolerates it (exit 0)',
    async () => {
      const { createMigrationShowCommand } = await import('../../src/commands/migration-show');
      const fixture = await setupSelfEdgeFixture();
      tempDirs.push(fixture.cwd);
      process.chdir(fixture.cwd);

      const exitCode = await runAndCaptureExit(() =>
        executeCommand(createMigrationShowCommand(), [fixture.selfEdgeRelDir, '--json']),
      );
      const envelope = firstJsonLine<Record<string, unknown>>(consoleOutput);

      expect(exitCode).toBe(0);
      // The rendered package carries the self-edge: from === to === HASH_A.
      expect(JSON.stringify(envelope)).toContain(HASH_A);
    },
    timeouts.typeScriptCompilation,
  );
});
