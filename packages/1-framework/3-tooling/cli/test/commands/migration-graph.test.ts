import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { ok } from '@internal/utils/result';
import { type } from 'arktype';
import { join } from 'pathe';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  type MigrationGraphJsonResult,
  migrationGraphJsonResultSchema,
} from '../../src/commands/json/schemas';
import { createMigrationGraphCommand } from '../../src/commands/migration-graph';
import { renderMigrationGraphLegend } from '../../src/utils/formatters/migration-graph-labels';
import type { GlobalFlags } from '../../src/utils/global-flags';
import { createTerminalUI } from '../../src/utils/terminal-ui';
import {
  executeCommand,
  parseJsonObjectFromCliCapture,
  setupCommandMocks,
} from '../utils/test-helpers';

const PRETTY: GlobalFlags = { format: 'pretty', explicitFormat: false };

const graphMocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: graphMocks.loadConfig,
}));

const TARGET = 'postgres';
const TARGET_FAMILY = 'sql';
const HASH_A = `aaaaaaa${'0'.repeat(57)}`;
const HASH_B = `bbbbbbb${'0'.repeat(57)}`;

const ADDITIVE_OP: MigrationPlanOperation = {
  id: 'table.users',
  label: 'Create table users',
  operationClass: 'additive',
};

function graphBaseConfig(contractOutput: string) {
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

const graphTempDirs: string[] = [];

async function setupGraphFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'read-cmd-graph-json-'));
  graphTempDirs.push(cwd);
  const contractPath = join(cwd, 'contract.json');
  await writeFile(
    contractPath,
    JSON.stringify({
      storage: { storageHash: HASH_B },
      schemaVersion: '1.0.0',
      target: TARGET,
      targetFamily: TARGET_FAMILY,
    }),
  );
  const appDir = join(cwd, 'migrations', 'app');
  await mkdir(appDir, { recursive: true });
  const writePkg = async (dirName: string, from: string | null, to: string) => {
    const baseMetadata: Omit<MigrationMetadata, 'migrationHash'> = {
      from,
      to,
      providedInvariants: [],
      createdAt: '2026-02-25T14:30:00.000Z',
    };
    const metadata: MigrationMetadata = {
      ...baseMetadata,
      migrationHash: computeMigrationHash(baseMetadata, [ADDITIVE_OP]),
    };
    await writeMigrationPackage(join(appDir, dirName), metadata, [ADDITIVE_OP]);
  };
  await writePkg('20260422T0720_initial', null, HASH_A);
  await writePkg('20260422T0742_migration', HASH_A, HASH_B);
  graphMocks.loadConfig.mockResolvedValue(ok(graphBaseConfig(contractPath)));
  return contractPath;
}

describe('migration graph --json envelope', () => {
  afterAll(() => {
    vi.doUnmock('@internal/config-loader');
  });

  afterEach(async () => {
    await Promise.all(graphTempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    graphTempDirs.length = 0;
    vi.clearAllMocks();
  });

  it('emits a { ok: true, spaces: [{ contracts, migrations }], summary } object matching the schema', async () => {
    const contractPath = await setupGraphFixture();

    const { consoleOutput, cleanup } = setupCommandMocks();
    try {
      await executeCommand(createMigrationGraphCommand(), ['--json', '--config', contractPath]);
    } finally {
      cleanup();
    }

    const envelope = parseJsonObjectFromCliCapture(consoleOutput) as MigrationGraphJsonResult;
    expect(migrationGraphJsonResultSchema(envelope) instanceof type.errors).toBe(false);
    expect(envelope.ok).toBe(true);
    expect(typeof envelope.summary).toBe('string');
    const appSpace = envelope.spaces.find((space) => space.space === 'app');
    expect(appSpace).toBeDefined();
    expect(appSpace?.migrations.map((migration) => migration.name)).toContain(
      '20260422T0720_initial',
    );
    expect(appSpace?.migrations[0]).toMatchObject({
      name: expect.any(String),
      hash: expect.any(String),
      toContract: expect.any(String),
    });
    const firstMigrationFromContract = appSpace?.migrations[0]?.fromContract;
    expect(
      firstMigrationFromContract === null || typeof firstMigrationFromContract === 'string',
    ).toBe(true);
    expect(appSpace?.contracts[0]).toMatchObject({
      hash: expect.any(String),
      refs: expect.any(Array),
    });
  });
});

describe('migration graph legend stream split', () => {
  it('routes the legend through the stderr rail, never stdout', () => {
    const ui = createTerminalUI({
      ...PRETTY,
      explicitFormat: true,
      interactive: true,
      color: false,
    });
    const stderr: string[] = [];
    const stderrSpy = vi.spyOn(ui, 'stderr').mockImplementation((message) => {
      stderr.push(message);
    });
    const outputSpy = vi.spyOn(ui, 'output').mockImplementation(() => {});

    ui.stderr(renderMigrationGraphLegend({ colorize: false }));
    ui.stderr('');

    const stderrText = stderr.join('\n');
    expect(stderrText).toContain('Legend:');
    expect(stderrText).toContain('applied');
    expect(stderrText).toContain('pending');
    expect(stderrText).toContain('@contract @db');
    expect(stderrText).toContain('(prod, staging)');
    expect(stderrText).toContain('reserved markers — also typeable as --from/--to tokens');
    expect(stderrText).toContain('user-defined refs');
    expect(stderrText).toContain('migration from contract aaaaaa to bbbbbb');
    expect(stderrText).not.toContain('gutter lanes by column');
    expect(stderr.at(-1)).toBe('');
    expect(outputSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
    outputSpy.mockRestore();
  });
});
