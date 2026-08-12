import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as configLoader from '@internal/config-loader';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { writeContractSnapshot } from '@internal/migration-tools/contract-snapshot-store';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { formatMigrationDirName, writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { ok } from '@internal/utils/result';
import { applicationDomainOf } from '@repo/test-utils';
import { type } from 'arktype';
import { join } from 'pathe';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDbSignCommand } from '../../src/commands/db-sign';
import {
  type MigrationSpaceGraphEntry,
  migrationGraphJsonResultSchema,
  migrationLogResultSchema,
} from '../../src/commands/json/schemas';
import { executeMigrationGraphCommand } from '../../src/commands/migration-graph';
import { executeMigrationLogCommand } from '../../src/commands/migration-log';
import { executeRefSetCommand } from '../../src/control-api/operations/ref';
import { parseGlobalFlags } from '../../src/utils/global-flags';
import { createTerminalUI } from '../../src/utils/terminal-ui';
import { executeCommand, setupCommandMocks } from '../utils/test-helpers';

const mocks = vi.hoisted(() => ({
  writeRef: vi.fn(),
  readMarker: vi.fn(),
  readLedger: vi.fn(),
  connect: vi.fn(),
  close: vi.fn(),
  schemaVerify: vi.fn(),
  sign: vi.fn(),
}));

vi.mock('@internal/config-loader', { spy: true });

vi.mock('@internal/migration-tools/refs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@internal/migration-tools/refs')>();
  return { ...actual, writeRef: mocks.writeRef };
});

vi.mock('../../src/control-api/client', () => ({
  createControlClient: vi.fn(() => ({
    connect: mocks.connect,
    readMarker: mocks.readMarker,
    readLedger: mocks.readLedger,
    close: mocks.close,
    schemaVerify: mocks.schemaVerify,
    sign: mocks.sign,
  })),
}));

const TARGET = 'postgres';
const TARGET_FAMILY = 'sql';
const HASH_A = `${'a'.repeat(64)}`;
const HASH_B = `${'b'.repeat(64)}`;

const ADDITIVE_OP: MigrationPlanOperation = {
  id: 'table.users',
  label: 'Create users',
  operationClass: 'additive',
};

const createdDirs: string[] = [];

function stubLoadConfig(contractOutput: string): void {
  vi.spyOn(configLoader, 'loadConfigForSections').mockResolvedValue(
    ok(baseConfig(contractOutput) as unknown as configLoader.PrismaNextConfig),
  );
}

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
    db: { connection: 'postgres://localhost/read-commands-golden' },
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

async function writeLinearMigrations(
  migrationsRoot: string,
): Promise<{ dirInit: string; dirNext: string }> {
  const appDir = join(migrationsRoot, 'app');
  await mkdir(appDir, { recursive: true });

  const writePkg = async (
    slug: string,
    from: string | null,
    to: string,
    date: Date,
  ): Promise<string> => {
    const dirName = formatMigrationDirName(date, slug);
    const metadataBase: Omit<MigrationMetadata, 'migrationHash'> = {
      from,
      to,
      providedInvariants: [],
      createdAt: date.toISOString(),
    };
    const metadata: MigrationMetadata = {
      ...metadataBase,
      migrationHash: computeMigrationHash(metadataBase, [ADDITIVE_OP]),
    };
    await writeMigrationPackage(join(appDir, dirName), metadata, [ADDITIVE_OP]);
    return dirName;
  };

  const dirInit = await writePkg('init', null, HASH_A, new Date('2026-01-01T10:00:00Z'));
  const dirNext = await writePkg('add_users', HASH_A, HASH_B, new Date('2026-01-02T10:00:00Z'));
  return { dirInit, dirNext };
}

async function writeEndContract(migrationsRootDir: string, storageHash: string): Promise<void> {
  const contract = {
    schemaVersion: '1',
    targetFamily: TARGET_FAMILY,
    target: TARGET,
    profileHash: `${'p'.repeat(64)}`,
    storage: { storageHash },
    domain: applicationDomainOf({ models: {} }),
    roots: {},
  };
  await writeContractSnapshot(migrationsRootDir, storageHash, {
    contractJson: contract,
    contractDts: 'export type Contract = unknown;\n',
  });
}

function migrationGraphJson(result: {
  spaces: readonly MigrationSpaceGraphEntry[];
  summary: string;
}): string {
  return JSON.stringify({ ok: true, spaces: [...result.spaces], summary: result.summary }, null, 2);
}

function migrationLogJson(
  records: readonly {
    space: string;
    name: string;
    hash: string;
    fromContract: string | null;
    toContract: string;
    appliedAt: string;
    operationCount: number;
  }[],
  summary: string,
): string {
  return JSON.stringify({ ok: true, records, summary }, null, 2);
}

describe('read commands --json golden', () => {
  afterAll(() => {
    vi.doUnmock('@internal/migration-tools/refs');
    vi.doUnmock('../../src/control-api/client');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue(undefined);
    mocks.close.mockResolvedValue(undefined);
    mocks.writeRef.mockResolvedValue(undefined);
    mocks.schemaVerify.mockResolvedValue({ ok: true, summary: 'Schema matches contract' });
    mocks.sign.mockResolvedValue({
      ok: true,
      summary: 'Database signed',
      contract: { storageHash: HASH_B },
      target: { expected: TARGET },
      marker: { created: true, updated: false },
      timings: { total: 0 },
    });
  });

  afterEach(async () => {
    await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    createdDirs.length = 0;
    vi.restoreAllMocks();
  });

  it('pins migration graph --json for a linear app chain', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'read-cmd-graph-json-'));
    createdDirs.push(cwd);
    const contractPath = await writeContract(cwd, HASH_B);
    const { dirInit, dirNext } = await writeLinearMigrations(join(cwd, 'migrations'));
    stubLoadConfig(contractPath);

    const flags = parseGlobalFlags({ json: true, quiet: true });
    const ui = createTerminalUI(flags);
    const result = await executeMigrationGraphCommand({ config: contractPath }, flags, ui);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(migrationGraphJsonResultSchema(result.value) instanceof type.errors).toBe(false);

    const json = migrationGraphJson(result.value);
    expect(json).toBe(
      [
        '{',
        '  "ok": true,',
        '  "spaces": [',
        '    {',
        '      "space": "app",',
        '      "contracts": [',
        '        {',
        `          "hash": "${EMPTY_CONTRACT_HASH}",`,
        '          "refs": []',
        '        },',
        '        {',
        `          "hash": "${HASH_A}",`,
        '          "refs": []',
        '        },',
        '        {',
        `          "hash": "${HASH_B}",`,
        '          "refs": []',
        '        }',
        '      ],',
        '      "migrations": [',
        '        {',
        `          "name": "${dirInit}",`,
        '          "hash": "19e023091ca806aa87b1b62a346198073a90d47c86df9d2b235bc47908ce43dc",',
        `          "fromContract": null,`,
        `          "toContract": "${HASH_A}"`,
        '        },',
        '        {',
        `          "name": "${dirNext}",`,
        '          "hash": "fc69130b1171503162cf807101f7c2590ba50ea1ef42087131b5664ae672559f",',
        `          "fromContract": "${HASH_A}",`,
        `          "toContract": "${HASH_B}"`,
        '        }',
        '      ]',
        '    }',
        '  ],',
        '  "summary": "1 space(s), 3 contract(s), 2 migration(s)"',
        '}',
      ].join('\n'),
    );
  });

  it('pins migration log --json for ledger apply history', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'read-cmd-log-json-'));
    createdDirs.push(cwd);
    const contractPath = await writeContract(cwd, HASH_B);
    const { dirInit, dirNext } = await writeLinearMigrations(join(cwd, 'migrations'));
    stubLoadConfig(contractPath);
    mocks.readLedger.mockResolvedValue([
      {
        space: 'app',
        migrationName: dirInit,
        migrationHash: 'init-mig',
        from: null,
        to: HASH_A,
        appliedAt: new Date('2026-03-01T08:00:00.000Z'),
        operationCount: 1,
      },
      {
        space: 'app',
        migrationName: dirNext,
        migrationHash: 'next-mig',
        from: HASH_A,
        to: HASH_B,
        appliedAt: new Date('2026-03-02T08:00:00.000Z'),
        operationCount: 1,
      },
    ]);

    const flags = parseGlobalFlags({ json: true, quiet: true });
    const ui = createTerminalUI(flags);
    const result = await executeMigrationLogCommand(
      { config: contractPath, db: 'postgres://localhost/read-commands-golden' },
      flags,
      ui,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const serialized = result.value.map((entry) => ({
      space: entry.space,
      name: entry.migrationName,
      hash: entry.migrationHash,
      fromContract: entry.from,
      toContract: entry.to,
      appliedAt: entry.appliedAt.toISOString(),
      operationCount: entry.operationCount,
    }));
    const summary = `${result.value.length} migration(s) applied`;
    const json = migrationLogJson(serialized, summary);
    const parsed = JSON.parse(json) as {
      ok: boolean;
      records: Array<{ name: string; appliedAt: string }>;
      summary: string;
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records.map((r) => r.name)).toEqual([dirInit, dirNext]);
    expect(parsed.records[0]!.appliedAt).toBe('2026-03-01T08:00:00.000Z');
    expect(typeof parsed.summary).toBe('string');
    expect(json).not.toContain('markerHash');
    expect(migrationLogResultSchema(parsed) instanceof type.errors).toBe(false);
  });

  it('pins ref set --json when resolving a migration dir name', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'read-cmd-ref-json-'));
    createdDirs.push(cwd);
    const contractPath = await writeContract(cwd, HASH_B);
    const { dirNext } = await writeLinearMigrations(join(cwd, 'migrations'));
    await writeEndContract(join(cwd, 'migrations'), HASH_B);
    stubLoadConfig(contractPath);

    const prev = process.cwd();
    process.chdir(cwd);
    let result: Awaited<ReturnType<typeof executeRefSetCommand>>;
    try {
      result = await executeRefSetCommand('staging', dirNext, {
        config: baseConfig(contractPath) as unknown as configLoader.PrismaNextConfig,
        cwd,
        configPath: contractPath,
      });
    } finally {
      process.chdir(prev);
    }
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const json = JSON.stringify(result.value, null, 2);
    expect(json).toBe(
      `{\n  "ok": true,\n  "ref": "staging",\n  "hash": "${HASH_B}",\n  "invariants": []\n}`,
    );
  });

  it('pins db sign --json when resolving contract from a migration dir', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'read-cmd-dbsign-json-'));
    createdDirs.push(cwd);
    const contractPath = await writeContract(cwd, HASH_B);
    const { dirNext } = await writeLinearMigrations(join(cwd, 'migrations'));
    await writeEndContract(join(cwd, 'migrations'), HASH_B);
    stubLoadConfig(contractPath);

    const { consoleOutput, cleanup } = setupCommandMocks({ isTTY: false });
    const signCmd = createDbSignCommand();
    const prev = process.cwd();
    process.chdir(cwd);
    let exitCode: number;
    try {
      exitCode = await executeCommand(signCmd, [
        dirNext,
        '--json',
        '--db',
        'postgres://localhost/read-commands-golden',
        '--config',
        contractPath,
      ]);
    } finally {
      process.chdir(prev);
      cleanup();
    }
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(consoleOutput.join('\n')) as {
      ok: boolean;
      summary: string;
      contract: { storageHash: string };
      target: { expected: string };
      marker: { created: boolean; updated: boolean };
      timings: { total: number };
    };
    expect(parsed.timings.total).toBeGreaterThanOrEqual(0);
    const { timings: _timings, ...stable } = parsed;
    expect(JSON.stringify(stable, null, 2)).toBe(
      [
        '{',
        '  "ok": true,',
        '  "summary": "Database signed",',
        '  "contract": {',
        `    "storageHash": "${HASH_B}"`,
        '  },',
        '  "target": {',
        `    "expected": "${TARGET}"`,
        '  },',
        '  "marker": {',
        '    "created": true,',
        '    "updated": false',
        '  }',
        '}',
      ].join('\n'),
    );
  });
});
