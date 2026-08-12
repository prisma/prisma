import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { ok } from '@internal/utils/result';
import { timeouts } from '@repo/test-utils';
import { join } from 'pathe';
import stripAnsi from 'strip-ansi';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeCommand, getExitCode, setupCommandMocks } from '../utils/test-helpers';

/**
 * End-to-end coverage for tamper detection under the tolerant
 * contract-space model. Each case lays down a valid migration package,
 * surgically corrupts `ops.json` after attestation, drives a real CLI
 * command, and captures the rendered diagnostic.
 *
 * The tolerant loader no longer throws on a corrupt package at load —
 * `readMigrationsDir` represents the tamper as a `hashMismatch`
 * violation and retains the package. Detection is therefore relocated
 * to the explicit `checkIntegrity()` gate, and the behaviour now splits
 * by command class (project spec § behaviour matrix):
 *
 *   - **Gating commands** (`migrate`, `migration plan`, `migration
 *     status`, `migration new`) refuse via the structured contract-space
 *     integrity envelope (`MIGRATION.CONTRACT_SPACE_VIOLATION` + `meta.violations[]`). For
 *     `migrate` the gate is a pure offline check that fires *before*
 *     `client.connect()`, preserving the "refuse before connecting"
 *     safety property — the stub driver is never reached.
 *   - **Read / render** (`migration show <target>`) loads the tolerant
 *     aggregate without an integrity gate and renders the named package.
 *
 * `loadConfig` is mocked because resolving a real `prisma-next.config.ts`
 * would pull in TypeScript transpilation and a target adapter. Everything
 * downstream of `loadConfig` runs against real on-disk fixtures: the
 * tampered package and the contract.json.
 */

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfig,
}));

const PACKAGE_DIR_NAME = '00001_tamper_test';
const FROM_HASH = 'from';
const TO_HASH = 'to';
const SCHEMA_VERSION = '1.0.0';
const TARGET = 'mock';
const TARGET_FAMILY = 'mock';
const CREATED_AT = '2026-02-25T14:30:00.000Z';

const ORIGINAL_OPS: readonly MigrationPlanOperation[] = [
  { id: 'table.users', label: 'Create table users', operationClass: 'additive' },
];

const TAMPERED_OPS: readonly MigrationPlanOperation[] = [
  ...ORIGINAL_OPS,
  { id: 'tamper.synthetic', label: 'Synthetic tamper op', operationClass: 'additive' },
];

interface CapturedDiagnostic {
  readonly exitCode: number;
  readonly envelope: CliErrorEnvelope;
  readonly humanText: string;
}

interface CliErrorEnvelope {
  readonly summary: string;
  readonly code: string;
  readonly why?: string;
  readonly fix?: string;
  readonly meta?: Record<string, unknown>;
  readonly where?: { readonly path?: string };
}

async function writeTestPackage(
  dir: string,
  metadataBase: Omit<MigrationMetadata, 'migrationHash'>,
  ops: readonly MigrationPlanOperation[],
): Promise<MigrationMetadata> {
  const metadata: MigrationMetadata = {
    ...metadataBase,
    migrationHash: computeMigrationHash(metadataBase, ops),
  };
  await writeMigrationPackage(dir, metadata, ops);
  return metadata;
}

function setupConfigMock(): void {
  // The mocked family.create() returns a stub family instance whose
  // `deserializeContract` is a pass-through. The tamper tests construct
  // an intentionally-skeletal contract (just `storage.storageHash`) to
  // get past the read-and-validate step in commands like `migrate` /
  // `migration plan` / `migration new` — the bug under test is about
  // **migration tamper detection**, not contract validation. The
  // pass-through stub keeps the contract read crossing the seam
  // (TML-2536's invariant) while letting the test drive at the
  // post-read tamper code path.
  mocks.loadConfig.mockResolvedValue(
    ok({
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
      adapter: {
        kind: 'adapter',
        familyId: TARGET_FAMILY,
        targetId: TARGET,
        create: () => ({ familyId: TARGET_FAMILY, targetId: TARGET }),
      },
      driver: {
        kind: 'driver',
        create: vi.fn().mockResolvedValue({ close: vi.fn().mockResolvedValue(undefined) }),
      },
      db: { connection: 'postgres://localhost/tamper-test' },
      // The fixture writes contract.json at this path under the per-test cwd
      // (see setupTamperFixture). Each test chdirs to its tempdir before
      // invoking the command, so the relative path resolves correctly.
      contract: { output: 'src/prisma/contract.json' },
    }),
  );
}

interface TamperFixture {
  readonly cwd: string;
  readonly packageDir: string;
  readonly relativePackageDir: string;
}

async function setupTamperFixture(): Promise<TamperFixture> {
  const cwd = await mkdtemp(join(tmpdir(), 'cli-tamper-'));

  const migrationsDir = join(cwd, 'migrations', 'app');
  await mkdir(migrationsDir, { recursive: true });
  const packageDir = join(migrationsDir, PACKAGE_DIR_NAME);

  await writeTestPackage(
    packageDir,
    {
      from: FROM_HASH,
      to: TO_HASH,
      providedInvariants: [],
      createdAt: CREATED_AT,
    },
    ORIGINAL_OPS,
  );

  // Tamper: append a synthetic op to ops.json after attestation. The metadata's
  // stored migrationHash now disagrees with the recomputed hash over the new op
  // list, which is exactly the failure mode `readMigrationPackage` flags via
  // `errorMigrationHashMismatch`.
  await writeFile(join(packageDir, 'ops.json'), JSON.stringify(TAMPERED_OPS, null, 2));

  // contract.json at the default location so commands that read the contract
  // (apply, plan, status) reach the tolerant aggregate read without erroring earlier.
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

  return { cwd, packageDir, relativePackageDir: join('migrations', 'app', PACKAGE_DIR_NAME) };
}

/**
 * Replaces a fixture's per-test absolute path with a stable token so the
 * captured envelopes from different tempdirs are byte-comparable.
 *
 * The human-rendered `why`/`fix` paths are cwd-relative, so in practice
 * the rendered text is already identical across tests (each test chdirs
 * into its own tempdir before invoking the command, and uses the same
 * package dir name). This normalization is a defensive belt: it scrubs
 * the absolute `meta.dir` in the JSON envelope and any future leakage
 * of an absolute path into the rendered surface.
 */
function normalizePaths(text: string, tempDir: string): string {
  return text.split(tempDir).join('<TMP_DIR>');
}

async function runAndCaptureExit(invoke: () => Promise<number>): Promise<number> {
  // `executeCommand` re-throws the synthetic "process.exit called" error
  // when the command exits non-zero (so callers can branch on it). We
  // pull the exit code out of the helper's mock immediately after the
  // throw so a subsequent invocation in the same test doesn't overwrite it.
  try {
    return await invoke();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'process.exit called') {
      throw error;
    }
    return getExitCode() ?? 0;
  }
}

async function captureDiagnostic(
  invokeJson: () => Promise<number>,
  invokeHuman: () => Promise<number>,
  consoleOutput: string[],
  consoleErrors: string[],
  tempDir: string,
): Promise<CapturedDiagnostic> {
  // --- JSON pass: structured envelope (used for the presence assertion).
  consoleOutput.length = 0;
  consoleErrors.length = 0;
  const exitCode = await runAndCaptureExit(invokeJson);
  const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
  if (!jsonLine) {
    throw new Error(
      `Expected a JSON envelope on stdout; got:\nstdout:\n${consoleOutput.join('\n')}\nstderr:\n${consoleErrors.join('\n')}`,
    );
  }
  const envelope = JSON.parse(jsonLine) as CliErrorEnvelope;

  // --- Human pass: rendered diagnostic returned for the caller's assertions.
  consoleOutput.length = 0;
  consoleErrors.length = 0;
  await runAndCaptureExit(invokeHuman);
  const humanText = normalizePaths(stripAnsi(consoleErrors.join('\n')), tempDir);

  return { exitCode, envelope, humanText };
}

/**
 * Assert the shared contract-space integrity refusal produced by the
 * gating commands: a non-zero exit, the `MIGRATION.CONTRACT_SPACE_VIOLATION` structured
 * envelope, the tamper carried in `meta.violations[]` (a
 * `hashMismatch` violation against the `app` space),
 * and the human-rendered "Contract-space integrity failure" line.
 */
function expectIntegrityRefusal(captured: CapturedDiagnostic): void {
  expect(captured.exitCode).not.toBe(0);
  expect(captured.envelope.code).toBe('MIGRATION.CONTRACT_SPACE_VIOLATION');
  expect(captured.envelope.summary).toContain('Contract-space integrity failure');

  const violations = captured.envelope.meta?.['violations'] as
    | ReadonlyArray<Record<string, unknown>>
    | undefined;
  expect(Array.isArray(violations)).toBe(true);
  expect(violations?.some((v) => v['kind'] === 'hashMismatch' && v['spaceId'] === 'app')).toBe(
    true,
  );

  expect(captured.humanText).toContain('Contract-space integrity failure');
}

describe('migration tamper detection (tolerant model, per-command class)', () => {
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
    // The repo-wide vitest config uses `isolate: false`, so the `vi.mock`
    // above leaks into the next test file in the same worker. Unmocking
    // restores `loadConfig` for downstream tests.
    vi.doUnmock('@internal/config-loader');
    vi.resetModules();
  });

  describe('gating commands refuse via the structured MIGRATION.CONTRACT_SPACE_VIOLATION integrity envelope', () => {
    it(
      'migrate refuses before connecting — the offline gate fires before client.connect',
      async () => {
        const { createMigrateCommand } = await import('../../src/commands/migrate');
        const fixture = await setupTamperFixture();
        tempDirs.push(fixture.cwd);
        process.chdir(fixture.cwd);

        const captured = await captureDiagnostic(
          () => executeCommand(createMigrateCommand(), ['--json']),
          () => executeCommand(createMigrateCommand(), ['--no-color', '--quiet']),
          consoleOutput,
          consoleErrors,
          fixture.cwd,
        );

        // The stub driver cannot connect; reaching the `5002` integrity
        // envelope (rather than a driver/connection error) proves the
        // gate ran before the driver was ever touched.
        expectIntegrityRefusal(captured);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'migration plan refuses before planning work',
      async () => {
        const { createMigrationPlanCommand } = await import('../../src/commands/migration-plan');
        const fixture = await setupTamperFixture();
        tempDirs.push(fixture.cwd);
        process.chdir(fixture.cwd);

        const captured = await captureDiagnostic(
          () => executeCommand(createMigrationPlanCommand(), ['--json']),
          () => executeCommand(createMigrationPlanCommand(), ['--no-color', '--quiet']),
          consoleOutput,
          consoleErrors,
          fixture.cwd,
        );

        expectIntegrityRefusal(captured);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'migration status refuses on the reader-subset package-corruption gate',
      async () => {
        const { createMigrationStatusCommand } = await import(
          '../../src/commands/migration-status'
        );
        const fixture = await setupTamperFixture();
        tempDirs.push(fixture.cwd);
        process.chdir(fixture.cwd);

        const captured = await captureDiagnostic(
          () => executeCommand(createMigrationStatusCommand(), ['--json']),
          () => executeCommand(createMigrationStatusCommand(), ['--no-color', '--quiet']),
          consoleOutput,
          consoleErrors,
          fixture.cwd,
        );

        expectIntegrityRefusal(captured);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'migration status tolerates package corruption when the app contract is unreadable',
      async () => {
        const { createMigrationStatusCommand } = await import(
          '../../src/commands/migration-status'
        );
        const fixture = await setupTamperFixture();
        tempDirs.push(fixture.cwd);
        process.chdir(fixture.cwd);

        await rm(join(fixture.cwd, 'src', 'prisma', 'contract.json'));

        consoleOutput.length = 0;
        consoleErrors.length = 0;
        const exitCode = await runAndCaptureExit(() =>
          executeCommand(createMigrationStatusCommand(), ['--json']),
        );
        expect(exitCode).toBe(0);

        const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
        expect(jsonLine).toBeDefined();
        const payload = JSON.parse(jsonLine!) as {
          readonly ok?: boolean;
          readonly diagnostics?: ReadonlyArray<{ readonly code?: string }>;
        };
        expect(payload.ok).toBe(true);
        expect(payload.diagnostics?.some((d) => d.code === 'CONTRACT.UNREADABLE')).toBe(true);
      },
      timeouts.typeScriptCompilation,
    );
  });

  describe('migration new narrows to app package corruption only', () => {
    it(
      'refuses on app-space hash mismatch before scaffolding',
      async () => {
        const { createMigrationNewCommand } = await import('../../src/commands/migration-new');
        const fixture = await setupTamperFixture();
        tempDirs.push(fixture.cwd);
        process.chdir(fixture.cwd);

        const captured = await captureDiagnostic(
          () => executeCommand(createMigrationNewCommand(), ['--name', 'next', '--json']),
          () =>
            executeCommand(createMigrationNewCommand(), [
              '--name',
              'next',
              '--no-color',
              '--quiet',
            ]),
          consoleOutput,
          consoleErrors,
          fixture.cwd,
        );

        expectIntegrityRefusal(captured);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'proceeds when cross-space layout drift is the only integrity fault',
      async () => {
        const ORPHAN_HASH = 'c'.repeat(64);
        const DEST_HASH = 'd'.repeat(64);
        const cwd = await mkdtemp(join(tmpdir(), 'cli-migration-new-orphan-'));
        tempDirs.push(cwd);

        await mkdir(join(cwd, 'migrations', 'app'), { recursive: true });

        const orphanDir = join(cwd, 'migrations', 'orphan_ext');
        await mkdir(orphanDir, { recursive: true });
        await writeTestPackage(
          join(orphanDir, '00001_orphan_base'),
          { from: null, to: ORPHAN_HASH, providedInvariants: [], createdAt: CREATED_AT },
          ORIGINAL_OPS,
        );
        await mkdir(join(orphanDir, 'refs'), { recursive: true });
        await writeFile(
          join(orphanDir, 'refs', 'head.json'),
          `${JSON.stringify({ hash: ORPHAN_HASH, invariants: [] }, null, 2)}\n`,
        );
        await writeFile(
          join(orphanDir, 'contract.json'),
          JSON.stringify({
            storage: { storageHash: ORPHAN_HASH, namespaces: {} },
            schemaVersion: SCHEMA_VERSION,
            target: TARGET,
            targetFamily: TARGET_FAMILY,
          }),
        );

        const contractDir = join(cwd, 'src', 'prisma');
        await mkdir(contractDir, { recursive: true });
        await writeFile(
          join(contractDir, 'contract.json'),
          JSON.stringify({
            storage: { storageHash: DEST_HASH, namespaces: {} },
            schemaVersion: SCHEMA_VERSION,
            target: TARGET,
            targetFamily: TARGET_FAMILY,
          }),
        );
        await writeFile(join(contractDir, 'contract.d.ts'), 'export {};\n');

        setupConfigMock();
        mocks.loadConfig.mockResolvedValue(
          ok({
            family: {
              familyId: TARGET_FAMILY,
              create: vi.fn().mockReturnValue({
                deserializeContract: (json: unknown) => json,
              }),
            },
            target: {
              id: TARGET,
              familyId: TARGET_FAMILY,
              targetId: TARGET,
              kind: 'target',
              migrations: {
                createPlanner: vi.fn().mockReturnValue({
                  emptyMigration: vi.fn().mockReturnValue({
                    renderTypeScript: () => 'export default async function migrate() {}',
                  }),
                }),
              },
            },
            adapter: {
              kind: 'adapter',
              familyId: TARGET_FAMILY,
              targetId: TARGET,
              create: () => ({ familyId: TARGET_FAMILY, targetId: TARGET }),
            },
            driver: { kind: 'driver', familyId: TARGET_FAMILY, targetId: TARGET },
            contract: { output: 'src/prisma/contract.json' },
          }),
        );

        process.chdir(cwd);

        const { createMigrationNewCommand } = await import('../../src/commands/migration-new');

        consoleOutput.length = 0;
        consoleErrors.length = 0;
        const exitCode = await runAndCaptureExit(() =>
          executeCommand(createMigrationNewCommand(), ['--name', 'layout-drift-ok', '--json']),
        );
        const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
        expect(exitCode, jsonLine ?? consoleErrors.join('\n')).toBe(0);

        expect(jsonLine).toBeDefined();
        const payload = JSON.parse(jsonLine!) as { readonly ok?: boolean; readonly dir?: string };
        expect(payload.ok).toBe(true);
        expect(payload.dir).toMatch(/migrations[/\\]app[/\\]/);
      },
      timeouts.typeScriptCompilation,
    );
  });

  describe('migration show uses the tolerant aggregate', () => {
    it(
      'migration show <path> renders a tampered package from aggregate load (exit 0)',
      async () => {
        const { createMigrationShowCommand } = await import('../../src/commands/migration-show');
        const fixture = await setupTamperFixture();
        tempDirs.push(fixture.cwd);
        process.chdir(fixture.cwd);

        try {
          await executeCommand(createMigrationShowCommand(), [
            fixture.relativePackageDir,
            '--json',
          ]);
        } catch {
          // process.exit
        }
        const exitCode = getExitCode() ?? 1;

        const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
        expect(exitCode, jsonLine ?? consoleErrors.join('\n')).toBe(0);
        expect(jsonLine).toBeDefined();
        const payload = JSON.parse(jsonLine!) as { readonly ok?: boolean };
        expect(payload.ok).toBe(true);
      },
      timeouts.typeScriptCompilation,
    );
  });
});
