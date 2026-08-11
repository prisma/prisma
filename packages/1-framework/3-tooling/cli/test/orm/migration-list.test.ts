import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { blindCast } from '@internal/utils/casts';
import { createTestCli } from '@prisma/cli-engine/testing';
import { createSqlContract } from '@repo/test-utils';
import { join } from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import { BIN_COMMANDS, BIN_GROUPS } from '../../src/orm/cli';

const HASH_A = `4cb4256${'0'.repeat(57)}`;

const dirs: string[] = [];

async function projectDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'orm-list-'));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

const ADDITIVE_OP = blindCast<
  MigrationPlanOperation,
  'Only the operation count and class are read by the list renderer'
>({
  id: 'schema.add_column',
  label: 'Add column',
  operationClass: 'additive',
});

const TEST_CONTRACT = createSqlContract({
  target: 'postgres',
  storage: {
    namespaces: {
      [UNBOUND_NAMESPACE_ID]: {
        id: UNBOUND_NAMESPACE_ID,
        entries: { table: { user: { columns: { id: {} } } } },
      },
    },
  },
});

function ormConfig(): Record<string, unknown> {
  return {
    family: {
      kind: 'family',
      id: 'sql',
      familyId: 'sql',
      version: '1.0.0',
      emission: {},
      create: () => ({}),
    },
    target: {
      kind: 'target',
      id: 'postgres',
      familyId: 'sql',
      targetId: 'postgres',
      version: '1.0.0',
      create: () => ({}),
    },
    adapter: {
      kind: 'adapter',
      id: 'pg',
      familyId: 'sql',
      targetId: 'postgres',
      version: '1.0.0',
      create: () => ({}),
    },
    contract: {
      source: { format: 'typescript', inputs: [], load: async () => TEST_CONTRACT },
      output: 'output/contract.json',
    },
  };
}

async function seedMigration(migrationsDir: string): Promise<void> {
  const packageDir = join(migrationsDir, 'app', '20250101T0000_initial');
  const ops = [ADDITIVE_OP];
  const base = blindCast<
    Omit<MigrationMetadata, 'migrationHash'>,
    'The list renderer reads only from/to, createdAt and providedInvariants'
  >({ from: null, to: HASH_A, providedInvariants: [], createdAt: '2025-01-01T00:00:00.000Z' });
  const metadata: MigrationMetadata = { ...base, migrationHash: computeMigrationHash(base, ops) };
  await writeMigrationPackage(packageDir, metadata, ops);
}

function harness(config: Record<string, unknown>) {
  return createTestCli({
    commands: BIN_COMMANDS,
    groups: BIN_GROUPS,
    config: { orm: config },
  });
}

describe('migration list', () => {
  it('settles as a completed envelope carrying the list document', async () => {
    const dir = await projectDir();
    await seedMigration(join(dir, 'migrations'));

    const run = await harness(ormConfig()).run(['migration', 'list', '--json'], { cwd: dir });

    expect(run.exitCode).toBe(0);
    const terminal = run.json.at(-1);
    expect(terminal).toMatchObject({ kind: 'result', envelope: { ok: true, exitCode: 0 } });
  });

  it('reports the migration it found', async () => {
    const dir = await projectDir();
    await seedMigration(join(dir, 'migrations'));

    const run = await harness(ormConfig()).run(['migration', 'list'], {
      cwd: dir,
      isTty: { stdout: true },
    });
    const list = run.presented?.data as { spaces: ReadonlyArray<{ space: string }> };

    expect(list.spaces.map((entry) => entry.space)).toEqual(['app']);
  });

  it('ships the rendered table as the stdout presentation, not as blocks', async () => {
    const dir = await projectDir();
    await seedMigration(join(dir, 'migrations'));

    const run = await harness(ormConfig()).run(['migration', 'list'], {
      cwd: dir,
      isTty: { stdout: true },
    });

    expect(run.presented?.presentation.stdout).toEqual([
      '○   4cb4256',
      '│↑  20250101T0000_initial        ∅ → 4cb4256  1 ops',
      '○   ∅',
      '',
      '1 migration(s) on disk',
    ]);
    expect(run.presented?.presentation.human).toEqual([
      { kind: 'fields', rows: [{ label: 'migrations', value: join(dir, 'migrations') }] },
    ]);
  });

  it('renders the empty-project line when no migration is on disk', async () => {
    const dir = await projectDir();

    const run = await harness(ormConfig()).run(['migration', 'list'], {
      cwd: dir,
      isTty: { stdout: true },
    });

    expect(run.presented?.presentation.stdout).toEqual([
      'There are no migrations in migrations/app/ yet',
    ]);
  });

  it('drops the rendered table in json mode so stdout stays a frame stream', async () => {
    const dir = await projectDir();
    await seedMigration(join(dir, 'migrations'));

    const run = await harness(ormConfig()).run(['migration', 'list', '--json'], { cwd: dir });

    expect(run.presented?.presentation.stdout).toEqual([]);
    for (const line of run.stdout.split('\n').filter((entry) => entry.length > 0)) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('names the narrowed space in the human header', async () => {
    const dir = await projectDir();
    await seedMigration(join(dir, 'migrations'));

    const run = await harness(ormConfig()).run(['migration', 'list', '--space', 'app'], {
      cwd: dir,
      isTty: { stdout: true },
    });

    expect(run.presented?.presentation.human).toEqual([
      {
        kind: 'fields',
        rows: [
          { label: 'migrations', value: join(dir, 'migrations') },
          { label: 'space', value: 'app' },
        ],
      },
    ]);
  });

  it('adds the glyph key as a block when --legend is passed', async () => {
    const dir = await projectDir();
    await seedMigration(join(dir, 'migrations'));

    const run = await harness(ormConfig()).run(['migration', 'list', '--legend'], {
      cwd: dir,
      isTty: { stdout: true },
    });
    const blocks = run.presented?.presentation.human ?? [];

    expect(blocks.at(-1)?.kind).toBe('list');
  });

  it('errors with the dotted code when the space does not exist', async () => {
    const dir = await projectDir();
    await seedMigration(join(dir, 'migrations'));

    const run = await harness(ormConfig()).run(['migration', 'list', '--space', 'nope', '--json'], {
      cwd: dir,
    });

    expect(run.exitCode).toBe(2);
    expect(run.json.at(-1)).toMatchObject({
      kind: 'result',
      envelope: { ok: false, error: { code: 'MIGRATION.SPACE_NOT_FOUND' } },
    });
  });

  it('gives the errored envelope typed next actions and no fix prose', async () => {
    const dir = await projectDir();
    await seedMigration(join(dir, 'migrations'));

    const run = await harness(ormConfig()).run(['migration', 'list', '--space', 'nope', '--json'], {
      cwd: dir,
    });
    const terminal = run.json.at(-1);
    const envelope =
      terminal !== undefined && terminal.kind === 'result' ? terminal.envelope : undefined;

    expect(envelope?.ok).toBe(false);
    expect(envelope?.nextActions.length).toBeGreaterThan(0);
    expect(envelope).not.toHaveProperty('fix');
  });

  it('fails before the handler when the orm section is structurally invalid', async () => {
    const dir = await projectDir();

    const run = await harness({ migrations: { dir: 42 } }).run(['migration', 'list', '--json'], {
      cwd: dir,
    });

    expect(run.exitCode).toBe(2);
    expect(run.json.at(-1)).toMatchObject({
      kind: 'result',
      envelope: { ok: false, error: { code: 'CLI.CONFIG_INVALID' } },
    });
  });

  it('resolves migrations against the run cwd, not the process cwd', async () => {
    const first = await projectDir();
    const second = await projectDir();
    await seedMigration(join(first, 'migrations'));
    await seedMigration(join(second, 'db'));
    const cli = harness(ormConfig());

    const runFirst = await cli.run(['migration', 'list'], { cwd: first, isTty: { stdout: true } });
    const runSecond = await harness({ ...ormConfig(), migrations: { dir: 'db' } }).run(
      ['migration', 'list'],
      { cwd: second, isTty: { stdout: true } },
    );

    expect(runFirst.presented?.presentation.human).toEqual([
      { kind: 'fields', rows: [{ label: 'migrations', value: join(first, 'migrations') }] },
    ]);
    expect(runSecond.presented?.presentation.human).toEqual([
      { kind: 'fields', rows: [{ label: 'migrations', value: join(second, 'db') }] },
    ]);
  });
});
