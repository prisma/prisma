import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { writeContractSnapshot } from '@internal/migration-tools/contract-snapshot-store';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { formatMigrationDirName, writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { ok } from '@internal/utils/result';
import { join } from 'pathe';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDbUpdateCommand } from '../../src/commands/db-update';
import { executeCommand, getExitCode, setupCommandMocks } from '../utils/test-helpers';

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  dbUpdate: vi.fn(),
  connect: vi.fn(),
  close: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfig,
}));

vi.mock('../../src/control-api/client', () => ({
  createControlClient: vi.fn(() => ({
    connect: mocks.connect,
    dbUpdate: mocks.dbUpdate,
    close: mocks.close,
  })),
}));

const HASH_A = `${'a'.repeat(64)}`;
const HASH_B = `${'b'.repeat(64)}`;
const ADDITIVE_OP: MigrationPlanOperation = {
  id: 'table.users',
  label: 'Create users',
  operationClass: 'additive',
};

const createdDirs: string[] = [];

async function setupFixture(): Promise<{
  contractPath: string;
  dirNext: string;
  endContract: Record<string, unknown>;
}> {
  const cwd = await mkdtemp(join(tmpdir(), 'db-update-read-agg-'));
  createdDirs.push(cwd);
  const contractPath = join(cwd, 'contract.json');
  const defaultContract = {
    storage: { storageHash: HASH_A },
    schemaVersion: '1.0.0',
    target: 'postgres',
    targetFamily: 'sql',
  };
  const endContract = {
    storage: { storageHash: HASH_B },
    schemaVersion: '1.0.0',
    target: 'postgres',
    targetFamily: 'sql',
  };
  await writeFile(contractPath, JSON.stringify(defaultContract));

  const appDir = join(cwd, 'migrations', 'app');
  await mkdir(appDir, { recursive: true });
  const dirInit = formatMigrationDirName(new Date('2026-01-01T10:00:00Z'), 'init');
  const dirNext = formatMigrationDirName(new Date('2026-01-02T10:00:00Z'), 'add_users');
  for (const [dirName, from, to] of [
    [dirInit, null, HASH_A] as const,
    [dirNext, HASH_A, HASH_B] as const,
  ]) {
    const metadataBase: Omit<MigrationMetadata, 'migrationHash'> = {
      from,
      to,
      providedInvariants: [],
      createdAt: '2026-01-01T10:00:00.000Z',
    };
    const metadata: MigrationMetadata = {
      ...metadataBase,
      migrationHash: computeMigrationHash(metadataBase, [ADDITIVE_OP]),
    };
    await writeMigrationPackage(join(appDir, dirName), metadata, [ADDITIVE_OP]);
  }
  await writeContractSnapshot(join(cwd, 'migrations'), HASH_B, {
    contractJson: endContract,
    contractDts: 'export type Contract = unknown;\n',
  });

  return { contractPath, dirNext, endContract };
}

describe('db update read aggregate --json golden', () => {
  afterAll(() => {
    vi.doUnmock('@internal/config-loader');
    vi.doUnmock('../../src/control-api/client');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue(undefined);
    mocks.close.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    createdDirs.length = 0;
  });

  it('pins the --json envelope when ref advancement throws a MigrationToolsError', async () => {
    // Command-level envelope pin for the db-sign/-update/-init group: a
    // MigrationToolsError raised inside the command (here MIGRATION.INVALID_REF_NAME
    // from --advance-ref validation) must surface byte-identical through --json.
    const { contractPath, dirNext } = await setupFixture();
    mocks.loadConfig.mockResolvedValue(
      ok({
        family: {
          familyId: 'sql',
          create: vi.fn().mockReturnValue({
            deserializeContract: (json: unknown) => json,
          }),
        },
        target: {
          id: 'postgres',
          familyId: 'sql',
          targetId: 'postgres',
          kind: 'target',
          migrations: {},
        },
        adapter: { kind: 'adapter', familyId: 'sql', targetId: 'postgres' },
        driver: { kind: 'driver' },
        db: { connection: 'postgres://localhost/db-update-golden' },
        contract: { output: contractPath },
      }),
    );
    mocks.dbUpdate.mockResolvedValue({
      ok: true,
      value: {
        ok: true as const,
        mode: 'apply' as const,
        destination: { storageHash: HASH_B },
        summary: 'Applied',
      },
    });

    const { consoleOutput, cleanup } = setupCommandMocks({ isTTY: false });
    const updateCmd = createDbUpdateCommand();
    let exitCode: number;
    try {
      exitCode = await executeCommand(updateCmd, [
        '--to',
        dirNext,
        '--advance-ref',
        'BAD NAME',
        '--json',
        '--db',
        'postgres://localhost/db-update-golden',
        '--config',
        contractPath,
      ]);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'process.exit called') {
        throw error;
      }
      exitCode = getExitCode() ?? 0;
    } finally {
      cleanup();
    }

    expect(exitCode).toBe(2);
    const json = consoleOutput.join('\n');
    expect(json).toBe(
      [
        '{',
        '  "ok": false,',
        '  "code": "MIGRATION.INVALID_REF_NAME",',
        '  "severity": "error",',
        '  "summary": "Invalid ref name",',
        `  "why": "Ref name \\"BAD NAME\\" is invalid. Names must be lowercase alphanumeric with hyphens or forward slashes (no \\".\\" or \\"..\\" segments).",`,
        `  "fix": "Use a valid ref name (e.g., \\"staging\\", \\"envs/production\\").",`,
        '  "nextActions": [],',
        '  "meta": {',
        '    "refName": "BAD NAME"',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('pins --json dry-run output when --to resolves via aggregate packages', async () => {
    const { contractPath, dirNext, endContract } = await setupFixture();
    mocks.loadConfig.mockResolvedValue(
      ok({
        family: {
          familyId: 'sql',
          create: vi.fn().mockReturnValue({
            deserializeContract: (json: unknown) => json,
          }),
        },
        target: {
          id: 'postgres',
          familyId: 'sql',
          targetId: 'postgres',
          kind: 'target',
          migrations: {},
        },
        adapter: { kind: 'adapter', familyId: 'sql', targetId: 'postgres' },
        driver: { kind: 'driver' },
        db: { connection: 'postgres://localhost/db-update-golden' },
        contract: { output: contractPath },
      }),
    );

    const dbUpdateValue = {
      ok: true as const,
      mode: 'plan' as const,
      plan: {
        operations: [{ id: 'table.users', label: 'Create users', operationClass: 'additive' }],
        preview: undefined,
      },
      destination: { storageHash: HASH_B },
      summary: 'Plan ready',
    };
    mocks.dbUpdate.mockResolvedValue({ ok: true, value: dbUpdateValue });

    const { consoleOutput, cleanup } = setupCommandMocks({ isTTY: false });
    const updateCmd = createDbUpdateCommand();
    const exitCode = await executeCommand(updateCmd, [
      '--to',
      dirNext,
      '--dry-run',
      '--json',
      '--db',
      'postgres://localhost/db-update-golden',
      '--config',
      contractPath,
    ]);
    cleanup();

    expect(exitCode).toBe(0);
    const callContract = mocks.dbUpdate.mock.calls[0]![0].contract as Record<string, unknown>;
    expect(callContract).toEqual(endContract);

    const json = consoleOutput.join('\n');
    const parsed = JSON.parse(json) as {
      ok: boolean;
      mode: string;
      plan: {
        targetId: string;
        destination: { storageHash: string };
        operations: Array<{ id: string; label: string; operationClass: string }>;
      };
      advancedRef: null;
      plannedAdvanceRef: null;
      summary: string;
      timings: { total: number };
    };
    expect(parsed.timings.total).toBeGreaterThanOrEqual(0);
    const { timings: _timings, ...stable } = parsed;
    expect(JSON.stringify(stable, null, 2)).toBe(
      [
        '{',
        '  "ok": true,',
        '  "mode": "plan",',
        '  "plan": {',
        '    "targetId": "postgres",',
        '    "destination": {',
        `      "storageHash": "${HASH_B}"`,
        '    },',
        '    "operations": [',
        '      {',
        '        "id": "table.users",',
        '        "label": "Create users",',
        '        "operationClass": "additive"',
        '      }',
        '    ]',
        '  },',
        '  "advancedRef": null,',
        '  "plannedAdvanceRef": null,',
        '  "summary": "Plan ready"',
        '}',
      ].join('\n'),
    );
  });
});
