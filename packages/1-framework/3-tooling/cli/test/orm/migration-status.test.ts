import { rm } from 'node:fs/promises';
import { writeRef } from '@internal/migration-tools/refs';
import type { MountedTree } from '@prisma/cli-engine';
import type { Diagnostic } from '@prisma/cli-engine/protocol';
import { createTestCli } from '@prisma/cli-engine/testing';
import { join } from 'pathe';
import stripAnsi from 'strip-ansi';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BIN_GROUPS as BinGroups } from '../../src/orm/cli';
import {
  createOfflineProject,
  invariantOp,
  type OfflineProject,
  offlineConfig,
  removeOfflineProjects,
  seedMigrationPackage,
} from './fixtures/offline-project';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  close: vi.fn(),
  readAllMarkers: vi.fn(),
  readLedger: vi.fn(),
}));

vi.mock('../../src/control-api/client', () => ({
  createControlClient: vi.fn(() => ({
    connect: mocks.connect,
    readAllMarkers: mocks.readAllMarkers,
    readLedger: mocks.readLedger,
    close: mocks.close,
  })),
}));

/**
 * The command tree is imported after the module registry is reset, so the
 * mocked client is the one `migration status` closes over. Repo-wide vitest
 * runs with `isolate: false`, and another file that loaded the command tree
 * first would otherwise have baked the real client into it.
 */
let commands: MountedTree;
let groups: typeof BinGroups;

beforeAll(async () => {
  vi.resetModules();
  const cli = await import('../../src/orm/cli');
  commands = cli.BIN_COMMANDS;
  groups = cli.BIN_GROUPS;
});

afterAll(() => {
  vi.doUnmock('../../src/control-api/client');
  vi.resetModules();
});

beforeEach(() => {
  mocks.connect.mockReset().mockResolvedValue(undefined);
  mocks.close.mockReset().mockResolvedValue(undefined);
  mocks.readAllMarkers.mockReset().mockResolvedValue(new Map());
  mocks.readLedger.mockReset().mockResolvedValue([]);
});

afterEach(removeOfflineProjects);

const HASH_HEAD = `c0ffee${'0'.repeat(58)}`;
const HASH_BASE = `beef${'1'.repeat(60)}`;
const HASH_UNKNOWN = `dead${'2'.repeat(60)}`;
const CONNECTION = 'postgres://user:secret@localhost:5432/appdb';

function driverConfig(project: OfflineProject): Record<string, unknown> {
  return {
    ...offlineConfig({ project }),
    driver: {
      kind: 'driver',
      id: 'pg',
      familyId: 'sql',
      targetId: 'postgres',
      version: '1.0.0',
      create: () => ({}),
    },
    db: { connection: CONNECTION },
  };
}

function harness(config: Record<string, unknown>) {
  return createTestCli({ commands, groups, config: { orm: config } });
}

/** A project whose app space carries one migration ∅ → HASH_HEAD. */
async function projectWithOneMigration(): Promise<
  OfflineProject & { readonly migrationHash: string }
> {
  const project = await createOfflineProject({ storageHash: HASH_HEAD });
  const seeded = await seedMigrationPackage({
    appMigrationsDir: project.appMigrationsDir,
    dirName: '20260101T0000_initial',
    from: null,
    to: HASH_HEAD,
  });
  return { ...project, migrationHash: seeded.migrationHash };
}

function codesAndSeverities(
  diagnostics: readonly Diagnostic[],
): ReadonlyArray<{ code: string; severity: string }> {
  return diagnostics.map(({ code, severity }) => ({ code, severity }));
}

describe('migration status', () => {
  it('settles as a completed envelope carrying the status document', async () => {
    const project = await projectWithOneMigration();
    mocks.readAllMarkers.mockResolvedValue(
      new Map([['app', { storageHash: HASH_HEAD, invariants: [] }]]),
    );
    mocks.readLedger.mockResolvedValue([{ migrationHash: project.migrationHash }]);

    const run = await harness(driverConfig(project)).run(['migration', 'status', '--json'], {
      cwd: project.dir,
    });

    expect(run.exitCode).toBe(0);
    expect(run.json.at(-1)).toMatchObject({ kind: 'result', envelope: { ok: true, exitCode: 0 } });
    expect(run.presented?.data).toMatchObject({
      ok: true,
      summary: 'Up to date',
      diagnostics: [],
      spaces: [
        {
          space: 'app',
          currentContract: HASH_HEAD,
          targetContract: HASH_HEAD,
          migrations: [expect.objectContaining({ status: 'applied' })],
        },
      ],
    });
  });

  it('records an unreadable contract as a warn diagnostic and still exits 0', async () => {
    const project = await projectWithOneMigration();
    await rm(project.contractPath);
    mocks.readAllMarkers.mockResolvedValue(
      new Map([['app', { storageHash: HASH_HEAD, invariants: [] }]]),
    );

    const run = await harness(driverConfig(project)).run(['migration', 'status', '--json'], {
      cwd: project.dir,
    });

    expect(run.exitCode).toBe(0);
    expect(codesAndSeverities(run.presented?.diagnostics ?? [])).toEqual([
      { code: 'CONTRACT.UNREADABLE', severity: 'warn' },
    ]);
    expect(run.json.at(-1)).toMatchObject({
      kind: 'result',
      envelope: { ok: true, exitCode: 0, diagnostics: [{ code: 'CONTRACT.UNREADABLE' }] },
    });
  });

  it('records a marker outside the graph as a warn diagnostic and still exits 0', async () => {
    const project = await projectWithOneMigration();
    mocks.readAllMarkers.mockResolvedValue(
      new Map([['app', { storageHash: HASH_UNKNOWN, invariants: [] }]]),
    );

    const run = await harness(driverConfig(project)).run(['migration', 'status', '--json'], {
      cwd: project.dir,
    });

    expect(run.exitCode).toBe(0);
    expect(codesAndSeverities(run.presented?.diagnostics ?? [])).toEqual([
      { code: 'MIGRATION.MARKER_NOT_IN_HISTORY', severity: 'warn' },
    ]);
    expect(run.presented?.data).toMatchObject({
      summary: `Database marker ${HASH_UNKNOWN.slice(0, 12)} is not in the on-disk migration graph`,
    });
  });

  it('records invariants the marker is missing as a warn diagnostic and still exits 0', async () => {
    const project = await createOfflineProject({ storageHash: HASH_HEAD });
    await seedMigrationPackage({
      appMigrationsDir: project.appMigrationsDir,
      dirName: '20260101T0000_base',
      from: null,
      to: HASH_BASE,
    });
    await seedMigrationPackage({
      appMigrationsDir: project.appMigrationsDir,
      dirName: '20260102T0000_unique_email',
      from: HASH_BASE,
      to: HASH_HEAD,
      ops: [invariantOp('users.email.unique')],
    });
    await writeRef(join(project.appMigrationsDir, 'refs'), 'production', {
      hash: HASH_HEAD,
      invariants: ['users.email.unique'],
    });
    mocks.readAllMarkers.mockResolvedValue(
      new Map([['app', { storageHash: HASH_BASE, invariants: [] }]]),
    );

    const run = await harness(driverConfig(project)).run(
      ['migration', 'status', '--to', 'production', '--json'],
      { cwd: project.dir },
    );

    expect(run.exitCode).toBe(0);
    expect(codesAndSeverities(run.presented?.diagnostics ?? [])).toEqual([
      { code: 'MIGRATION.MISSING_INVARIANTS', severity: 'warn' },
    ]);
    expect(run.presented?.diagnostics.at(0)).toMatchObject({
      summary: 'missing invariant(s): users.email.unique',
      meta: { invariants: ['users.email.unique'], ref: 'production' },
    });
  });

  it('keeps the findings in the json document as well as on the envelope', async () => {
    const project = await projectWithOneMigration();
    mocks.readAllMarkers.mockResolvedValue(
      new Map([['app', { storageHash: HASH_UNKNOWN, invariants: [] }]]),
    );

    const run = await harness(driverConfig(project)).run(['migration', 'status', '--json'], {
      cwd: project.dir,
    });
    const document = run.presented?.data as { diagnostics: ReadonlyArray<{ code: string }> };

    expect(document.diagnostics).toEqual([
      {
        code: 'MIGRATION.MARKER_NOT_IN_HISTORY',
        severity: 'warn',
        message:
          'Database was updated outside the migration system (marker does not match any migration)',
        hints: [expect.stringContaining('db sign'), expect.stringContaining('db update')],
      },
    ]);
  });

  it('heads the human output with the migrations directory and the masked database', async () => {
    const project = await projectWithOneMigration();
    mocks.readAllMarkers.mockResolvedValue(
      new Map([['app', { storageHash: HASH_HEAD, invariants: [] }]]),
    );

    const run = await harness(driverConfig(project)).run(['migration', 'status'], {
      cwd: project.dir,
      isTty: { stdout: true },
    });

    expect(run.presented?.presentation.human.at(0)).toEqual({
      kind: 'fields',
      rail: true,
      rows: [
        { label: 'migrations', value: 'migrations' },
        { label: 'database', value: 'postgres://****:****@localhost:5432/appdb' },
      ],
    });
  });

  it('draws the space tree as toned spans rather than a pre-coloured string', async () => {
    const project = await projectWithOneMigration();
    mocks.readAllMarkers.mockResolvedValue(
      new Map([['app', { storageHash: HASH_HEAD, invariants: [] }]]),
    );

    const run = await harness(driverConfig(project)).run(['migration', 'status'], {
      cwd: project.dir,
      isTty: { stdout: true },
    });
    const drawing = run.presented?.presentation.human.at(1);

    expect(drawing).toMatchObject({ kind: 'drawing' });
    const lines = drawing !== undefined && drawing.kind === 'drawing' ? drawing.lines : [];
    expect(lines.length).toBeGreaterThan(0);
    expect(JSON.stringify(lines)).not.toContain('\\u001b');
    expect(JSON.stringify(lines)).toContain('"tone"');
  });

  it('renders the tree and the headline to stderr', async () => {
    const project = await projectWithOneMigration();
    mocks.readAllMarkers.mockResolvedValue(
      new Map([['app', { storageHash: HASH_HEAD, invariants: [] }]]),
    );

    const run = await harness(driverConfig(project)).run(['migration', 'status'], {
      cwd: project.dir,
      isTty: { stdout: true, stderr: true },
    });
    const rendered = stripAnsi(run.stderr);

    expect(rendered).toContain('20260101T0000_initial');
    expect(rendered).toContain('Up to date');
    expect(run.stdout).toBe('');
    expect(run.presented?.presentation.stdout).toEqual([]);
  });

  it('closes the ends of the run summary line with the pending count', async () => {
    const project = await projectWithOneMigration();
    mocks.readAllMarkers.mockResolvedValue(new Map());

    const run = await harness(driverConfig(project)).run(['migration', 'status'], {
      cwd: project.dir,
      isTty: { stdout: true },
    });

    expect(run.presented?.presentation.human.at(-1)).toEqual({
      kind: 'summary',
      status: 'warn',
      text: `1 pending — run \`prisma-next migrate --to ${HASH_HEAD.slice(0, 12)}\``,
    });
  });

  it('never opens a connection when --from asks for an offline preview', async () => {
    const project = await projectWithOneMigration();

    const run = await harness(driverConfig(project)).run(
      ['migration', 'status', '--from', HASH_HEAD, '--json'],
      { cwd: project.dir },
    );

    expect(run.exitCode).toBe(0);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('errors when no connection is configured and --from is absent', async () => {
    const project = await projectWithOneMigration();
    const config = driverConfig(project);

    const run = await harness({ ...config, db: undefined }).run(['migration', 'status', '--json'], {
      cwd: project.dir,
    });

    expect(run.exitCode).toBe(2);
    expect(run.json.at(-1)).toMatchObject({
      kind: 'result',
      envelope: { ok: false, error: { code: 'CONFIG.DB_CONNECTION_REQUIRED' } },
    });
  });

  it('errors when --space names a space that is not on disk', async () => {
    const project = await projectWithOneMigration();
    mocks.readAllMarkers.mockResolvedValue(new Map());

    const run = await harness(driverConfig(project)).run(
      ['migration', 'status', '--space', 'nope', '--json'],
      { cwd: project.dir },
    );

    expect(run.exitCode).toBe(2);
    expect(run.json.at(-1)).toMatchObject({
      kind: 'result',
      envelope: { ok: false, error: { code: 'MIGRATION.SPACE_NOT_FOUND' } },
    });
  });

  it('prints the glyph key as its own drawing under --legend', async () => {
    const project = await projectWithOneMigration();
    mocks.readAllMarkers.mockResolvedValue(new Map());

    const run = await harness(driverConfig(project)).run(['migration', 'status', '--legend'], {
      cwd: project.dir,
      isTty: { stdout: true },
    });
    const blocks = run.presented?.presentation.human ?? [];

    expect(blocks.at(1)).toMatchObject({ kind: 'drawing' });
    expect(JSON.stringify(blocks.at(1))).toContain('applied');
  });

  it('closes the connection and keeps the structured error when the marker read fails', async () => {
    const project = await projectWithOneMigration();
    mocks.readAllMarkers.mockRejectedValue(new Error('connection reset'));
    mocks.close.mockRejectedValue(new Error('close failed'));

    const run = await harness(driverConfig(project)).run(['migration', 'status', '--json'], {
      cwd: project.dir,
    });

    expect(mocks.close).toHaveBeenCalled();
    expect(run.exitCode).toBe(2);
    expect(run.json.at(-1)).toMatchObject({
      kind: 'result',
      envelope: { ok: false, error: { code: 'CLI.UNEXPECTED' } },
    });
  });
});
