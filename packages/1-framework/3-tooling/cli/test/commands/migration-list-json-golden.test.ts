import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { writeRef } from '@internal/migration-tools/refs';
import { ok } from '@internal/utils/result';
import { type } from 'arktype';
import { join } from 'pathe';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { migrationListResultSchema } from '../../src/commands/json/schemas';
import { executeMigrationListCommand } from '../../src/commands/migration-list';
import { parseGlobalFlags } from '../../src/utils/global-flags';
import { createTerminalUI } from '../../src/utils/terminal-ui';

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfig,
}));

const TARGET = 'postgres';
const TARGET_FAMILY = 'sql';
const HASH_4cb4256 = `4cb4256${'0'.repeat(57)}`;
const HASH_55bada2 = `55bada2${'0'.repeat(57)}`;
const HASH_2f45cc7 = `2f45cc7${'0'.repeat(57)}`;
const HASH_804e018 = `804e018${'0'.repeat(57)}`;

const ADDITIVE_OP: MigrationPlanOperation = {
  id: 'table.users',
  label: 'Create table users',
  operationClass: 'additive',
};

const BACKFILL_OP = {
  id: 'data.backfill_emails',
  label: 'Backfill emails',
  operationClass: 'data',
  invariantId: 'backfill_emails_v1',
} as unknown as MigrationPlanOperation;

const createdDirs: string[] = [];

function baseConfig(contractOutput: string) {
  return {
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
      migrations: {},
    },
    adapter: { kind: 'adapter', familyId: TARGET_FAMILY, targetId: TARGET },
    driver: { kind: 'driver' },
    contract: { output: contractOutput },
    migrations: { dir: 'migrations' },
  };
}

async function writeContract(cwd: string, storageHash: string): Promise<string> {
  const contractPath = join(cwd, 'contract.json');
  await writeFile(
    contractPath,
    JSON.stringify({
      storage: { storageHash },
      schemaVersion: '1.0.0',
      target: TARGET,
      targetFamily: TARGET_FAMILY,
    }),
  );
  return contractPath;
}

async function writeSliceSpecPackages(migrationsRoot: string): Promise<void> {
  const writePkg = async (
    dirName: string,
    from: string | null,
    to: string,
    ops: readonly MigrationPlanOperation[],
    providedInvariants?: readonly string[],
  ) => {
    const baseMetadata: Omit<MigrationMetadata, 'migrationHash'> = {
      from,
      to,
      providedInvariants: providedInvariants ?? [],
      createdAt: '2026-02-25T14:30:00.000Z',
    };
    const metadata: MigrationMetadata = {
      ...baseMetadata,
      migrationHash: computeMigrationHash(baseMetadata, ops),
    };
    await writeMigrationPackage(join(migrationsRoot, 'app', dirName), metadata, ops);
  };

  await writePkg('20260422T0720_initial', null, HASH_4cb4256, [ADDITIVE_OP]);
  await writePkg('20260422T0742_migration', HASH_4cb4256, HASH_55bada2, [ADDITIVE_OP]);
  await writePkg('20260422T0748_migration', HASH_55bada2, HASH_2f45cc7, [ADDITIVE_OP]);
  await writePkg('20260518T1701_namespaces_bookend', HASH_2f45cc7, HASH_804e018, [ADDITIVE_OP]);
  await writePkg(
    '20260601T1200_backfill_emails',
    HASH_55bada2,
    HASH_55bada2,
    [BACKFILL_OP],
    ['backfill_emails_v1'],
  );

  const refsDir = join(migrationsRoot, 'app', 'refs');
  await mkdir(refsDir, { recursive: true });
  await writeRef(refsDir, 'production', { hash: HASH_55bada2, invariants: [] });
  await writeRef(refsDir, 'staging', { hash: HASH_2f45cc7, invariants: [] });
  await writeRef(refsDir, 'db', { hash: HASH_804e018, invariants: [] });
}

describe('migration list --json golden', () => {
  afterAll(() => {
    vi.doUnmock('@internal/config-loader');
  });

  afterEach(async () => {
    await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    createdDirs.length = 0;
    vi.clearAllMocks();
  });

  it('pins migration list --json for the slice-spec worked example', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'read-cmd-list-json-'));
    createdDirs.push(cwd);
    const contractPath = await writeContract(cwd, HASH_55bada2);
    await mkdir(join(cwd, 'migrations', 'app'), { recursive: true });
    await writeSliceSpecPackages(join(cwd, 'migrations'));
    mocks.loadConfig.mockResolvedValue(ok(baseConfig(contractPath)));

    const flags = parseGlobalFlags({ json: true, quiet: true });
    const ui = createTerminalUI(flags);
    const result = await executeMigrationListCommand({ config: contractPath }, flags, ui);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const schemaResult = migrationListResultSchema(result.value.list);
    expect(schemaResult instanceof type.errors).toBe(false);

    const json = JSON.stringify(result.value.list, null, 2);
    expect(json).toContain('"ok": true');
    expect(json).toContain('"summary": "5 migration(s) on disk"');
    expect(json).toContain('"space": "app"');
    expect(json).toContain('"name": "20260601T1200_backfill_emails"');
    expect(json).toContain('"backfill_emails_v1"');
    expect(json).toContain('"production"');
    expect(json).toContain('"name": "20260422T0720_initial"');
    const parsed = JSON.parse(json) as {
      spaces: Array<{ migrations: Array<{ name: string }> }>;
    };
    expect(parsed.spaces[0]?.migrations.map((m) => m.name)).toEqual([
      '20260601T1200_backfill_emails',
      '20260518T1701_namespaces_bookend',
      '20260422T0748_migration',
      '20260422T0742_migration',
      '20260422T0720_initial',
    ]);
  });

  it('pins head ref decoration on extension tip migration --json', async () => {
    const HASH_POSTGIS = `9aabbcc${'0'.repeat(57)}`;
    const cwd = await mkdtemp(join(tmpdir(), 'read-cmd-list-head-json-'));
    createdDirs.push(cwd);
    const contractPath = await writeContract(cwd, HASH_55bada2);
    const postgisDir = join(cwd, 'migrations', 'postgis');
    await mkdir(join(postgisDir, 'refs'), { recursive: true });
    const baseMetadata: Omit<MigrationMetadata, 'migrationHash'> = {
      from: null,
      to: HASH_POSTGIS,
      providedInvariants: [],
      createdAt: '2026-02-25T14:30:00.000Z',
    };
    const metadata: MigrationMetadata = {
      ...baseMetadata,
      migrationHash: computeMigrationHash(baseMetadata, [ADDITIVE_OP]),
    };
    await writeMigrationPackage(join(postgisDir, '20260601T0000_install_postgis'), metadata, [
      ADDITIVE_OP,
    ]);
    await writeFile(
      join(postgisDir, 'refs', 'head.json'),
      `${JSON.stringify({ hash: HASH_POSTGIS, invariants: [] }, null, 2)}\n`,
    );
    await writeFile(
      join(postgisDir, 'contract.json'),
      JSON.stringify({
        storage: { storageHash: HASH_POSTGIS },
        schemaVersion: '1.0.0',
        target: TARGET,
        targetFamily: TARGET_FAMILY,
      }),
    );
    mocks.loadConfig.mockResolvedValue(ok(baseConfig(contractPath)));

    const flags = parseGlobalFlags({ json: true, quiet: true });
    const ui = createTerminalUI(flags);
    const result = await executeMigrationListCommand({ config: contractPath }, flags, ui);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const postgisSpace = result.value.list.spaces.find((s) => s.space === 'postgis');
    expect(postgisSpace?.migrations[0]?.refs).toEqual(['head']);
  });
});
