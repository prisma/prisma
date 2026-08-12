import type { Contract } from '@internal/contract/types';
import { errorUnfilledPlaceholder } from '@internal/errors/migration';
import {
  type ContractAtResult,
  createAggregateContractSpace,
  createContractSpaceAggregate,
} from '@internal/migration-tools/aggregate';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import {
  errorContractSnapshotMissing,
  MigrationToolsError,
} from '@internal/migration-tools/errors';
import { reconstructGraph } from '@internal/migration-tools/migration-graph';
import type { OnDiskMigrationPackage } from '@internal/migration-tools/package';
import { ok } from '@internal/utils/result';
import { timeouts } from '@repo/test-utils';
import { join } from 'pathe';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MigrationPlanResult } from '../../src/control-api/operations/migration-plan';
import { executeCommand, setupCommandMocks } from '../utils/test-helpers';

type CreateMigrationPlanCommand =
  typeof import('../../src/commands/migration-plan')['createMigrationPlanCommand'];

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readRefs: vi.fn(),
  writeMigrationPackage: vi.fn(),
  writeContractSnapshot: vi.fn(),
  writeMigrationTs: vi.fn(),
  assertFrameworkComponentsCompatible: vi.fn(),
  extractSqlDdl: vi.fn(),
  createControlStack: vi.fn(),
  runContractSpaceSeedPhase: vi.fn(),
  buildContractSpaceAggregate: vi.fn(),
  loadContractSpaceAggregateForCli: vi.fn(),
}));

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    readFile: mocks.readFile,
    mkdir: mocks.mkdir,
    writeFile: mocks.writeFile,
  };
});

vi.mock('../../src/control-api/operations/contract-space-seed-phase', () => ({
  runContractSpaceSeedPhase: mocks.runContractSpaceSeedPhase,
}));

vi.mock('../../src/control-api/operations/contract-space-aggregate-loader', () => ({
  buildContractSpaceAggregate: mocks.buildContractSpaceAggregate,
  loadContractSpaceAggregateForCli: mocks.loadContractSpaceAggregateForCli,
}));

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfig,
}));

vi.mock('@internal/migration-tools/refs', async () => {
  const actual = await vi.importActual<typeof import('@internal/migration-tools/refs')>(
    '@internal/migration-tools/refs',
  );
  return { ...actual, readRefs: mocks.readRefs };
});

vi.mock('@internal/migration-tools/io', async () => {
  const actual = await vi.importActual<typeof import('@internal/migration-tools/io')>(
    '@internal/migration-tools/io',
  );
  return {
    ...actual,
    writeMigrationPackage: mocks.writeMigrationPackage,
  };
});

vi.mock('@internal/migration-tools/contract-snapshot-store', async () => {
  const actual = await vi.importActual<
    typeof import('@internal/migration-tools/contract-snapshot-store')
  >('@internal/migration-tools/contract-snapshot-store');
  return { ...actual, writeContractSnapshot: mocks.writeContractSnapshot };
});

vi.mock('@internal/migration-tools/migration-ts', () => ({
  writeMigrationTs: mocks.writeMigrationTs,
}));

vi.mock('../../src/utils/framework-components', () => ({
  assertFrameworkComponentsCompatible: mocks.assertFrameworkComponentsCompatible,
}));

vi.mock('../../src/control-api/operations/extract-sql-ddl', () => ({
  extractSqlDdl: mocks.extractSqlDdl,
}));

vi.mock('@internal/framework-components/control', async () => {
  const actual = await vi.importActual<typeof import('@internal/framework-components/control')>(
    '@internal/framework-components/control',
  );
  return { ...actual, createControlStack: mocks.createControlStack };
});

const SAME_HASH = `${'a'.repeat(64)}`;
const OLD_HASH = `${'b'.repeat(64)}`;
const NEW_HASH = `${'c'.repeat(64)}`;
const REFS_DIR = '/tmp/test/migrations/app/refs';
const MIGRATIONS_DIR = '/tmp/test/migrations';

function makeContractJson(storageHash: string, target = 'mongo'): string {
  return JSON.stringify({ storage: { storageHash, namespaces: {} }, target });
}

function sampleSnapshot(storageHash: string) {
  return {
    contract: JSON.parse(makeContractJson(storageHash)),
    contractDts: 'export type Contract = unknown;\n',
  };
}

function buildResolutionSpace(
  bundles: readonly OnDiskMigrationPackage[],
  refs: Record<string, { hash: string; invariants: readonly string[] }> = {},
) {
  const space = createAggregateContractSpace({
    spaceId: 'app',
    packages: bundles,
    refs,
    headRef:
      bundles.length > 0
        ? { hash: bundles[bundles.length - 1]!.metadata.to, invariants: [] }
        : null,
    refsDir: REFS_DIR,
    migrationsDir: MIGRATIONS_DIR,
    resolveContract: () => JSON.parse(makeContractJson(NEW_HASH)) as Contract,
    deserializeContract: (c: unknown) => c as Contract,
  });

  vi.spyOn(space, 'contractAt').mockImplementation(
    async (hash, opts): Promise<ContractAtResult> => {
      if (opts?.refName !== undefined) {
        const snap = sampleSnapshot(hash);
        return {
          hash,
          contract: snap.contract as Contract,
          contractJson: snap.contract,
          contractDts: snap.contractDts,
          provenance: 'ref',
        };
      }

      const matchingBundle = bundles.find((pkg) => pkg.metadata.to === hash);
      if (!matchingBundle) {
        throw new MigrationToolsError(
          'MIGRATION.BUNDLE_NOT_FOUND_FOR_GRAPH_NODE',
          `No migration bundle found for graph node ${hash}`,
          {
            why: `The hash ${hash} is a graph node but no on-disk migration package has a destination (\`to\`) hash matching it.`,
            fix: 'Provide a ref or hash that corresponds to an existing migration package, or run `migration list` to see available migrations.',
            meta: { hash },
          },
        );
      }

      const { readFile } = await import('node:fs/promises');
      const jsonPath = join(matchingBundle.dirPath, 'predecessor-snapshot.json');
      const dtsPath = join(matchingBundle.dirPath, 'predecessor-snapshot.d.ts');
      try {
        const [rawJson, contractDts] = await Promise.all([
          readFile(jsonPath, 'utf-8'),
          readFile(dtsPath, 'utf-8'),
        ]);
        const contractJson: unknown = JSON.parse(rawJson);
        return {
          hash,
          contract: contractJson as Contract,
          contractJson,
          contractDts,
          provenance: 'graph-node',
        };
      } catch (error) {
        if (error instanceof Error && (error as { code?: string }).code === 'ENOENT') {
          throw errorContractSnapshotMissing(hash, jsonPath);
        }
        throw error;
      }
    },
  );

  return space;
}

function setupResolutionAggregate(
  bundles: readonly OnDiskMigrationPackage[],
  refs: Record<string, { hash: string; invariants: readonly string[] }> = {},
): void {
  mocks.loadContractSpaceAggregateForCli.mockResolvedValue(
    ok(
      createContractSpaceAggregate({
        targetId: 'mongo',
        app: buildResolutionSpace(bundles, refs),
        extensions: [],
        checkIntegrity: () => [],
      }),
    ),
  );
}

function setupDbRefFromHash(hash: string, bundles: readonly OnDiskMigrationPackage[] = []): void {
  setupResolutionAggregate(bundles, { db: { hash, invariants: [] } });
}

function setupGreenfieldRefs(bundles: readonly OnDiskMigrationPackage[] = []): void {
  setupResolutionAggregate(bundles, {});
}

function makeBundle(from: string, to: string, dirName: string): OnDiskMigrationPackage {
  return {
    dirName,
    dirPath: `/tmp/test/migrations/${dirName}`,
    metadata: {
      from: from === EMPTY_CONTRACT_HASH ? null : from,
      to,
      migrationHash: `mig-${dirName}`,
      createdAt: '2026-03-01T09:00:00.000Z',
      providedInvariants: [],
    },
    ops: [],
  };
}

function graphWithPriorMigration(fromHash: string): {
  bundles: OnDiskMigrationPackage[];
  graph: ReturnType<typeof reconstructGraph>;
} {
  const bundles = [makeBundle(EMPTY_CONTRACT_HASH, fromHash, '20260301T0900_prev')];
  return { bundles, graph: reconstructGraph(bundles) };
}

function graphWithTwoMigrations(
  baselineHash: string,
  tipHash: string,
): {
  bundles: OnDiskMigrationPackage[];
  graph: ReturnType<typeof reconstructGraph>;
} {
  const bundles = [
    makeBundle(EMPTY_CONTRACT_HASH, baselineHash, '20260301T0900_baseline'),
    makeBundle(baselineHash, tipHash, '20260301T0905_add_model'),
  ];
  return { bundles, graph: reconstructGraph(bundles) };
}

function defaultPlannerSuccess(
  operations: readonly { id: string; label: string; operationClass: string }[],
) {
  return {
    kind: 'success' as const,
    plan: {
      operations,
      renderTypeScript: vi.fn().mockReturnValue('// migration.ts'),
    },
  };
}

function setupBaseConfig(
  plannerPlan = vi
    .fn()
    .mockReturnValue(
      defaultPlannerSuccess([
        { id: 'table.user', label: 'Create table "user"', operationClass: 'additive' },
      ]),
    ),
): void {
  const planner = { plan: plannerPlan };
  mocks.loadConfig.mockResolvedValue(
    ok({
      family: {
        familyId: 'mongo',
        create: vi.fn().mockReturnValue({
          deserializeContract: (c: unknown) => c,
        }),
      },
      target: {
        id: 'mongo',
        familyId: 'mongo',
        targetId: 'mongo',
        kind: 'target',
        migrations: {
          createPlanner: vi.fn().mockReturnValue(planner),
          contractToSchema: vi.fn().mockReturnValue({}),
        },
      },
      adapter: {
        kind: 'adapter',
        familyId: 'mongo',
        targetId: 'mongo',
        create: () => ({ familyId: 'mongo', targetId: 'mongo' }),
      },
      contract: { output: '/tmp/test/contract.json' },
      migrations: { dir: '/tmp/test/migrations' },
    }),
  );
  mocks.createControlStack.mockReturnValue({});
}

function setupAutoBaselineEmptyGraph(fromHash = OLD_HASH, toHash = NEW_HASH): void {
  const planMock = vi
    .fn()
    .mockReturnValueOnce(
      defaultPlannerSuccess([
        { id: 'baseline.table', label: 'Create baseline table', operationClass: 'additive' },
      ]),
    )
    .mockReturnValueOnce(
      defaultPlannerSuccess([
        { id: 'delta.table', label: 'Create delta table', operationClass: 'additive' },
      ]),
    );
  setupBaseConfig(planMock);
  mocks.readFile.mockResolvedValue(makeContractJson(toHash));
  setupDbRefFromHash(fromHash, []);
  mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);
  mocks.writeMigrationPackage.mockResolvedValue(undefined);
  mocks.extractSqlDdl.mockReturnValue([]);
}

describe('migration plan command', () => {
  let consoleOutput: string[];
  let cleanupMocks: () => void;
  let createMigrationPlanCommand: CreateMigrationPlanCommand;

  beforeEach(async () => {
    vi.resetModules();
    ({ createMigrationPlanCommand } = await import('../../src/commands/migration-plan'));

    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    cleanupMocks = commandMocks.cleanup;

    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.runContractSpaceSeedPhase.mockResolvedValue({ seeded: [] });
    mocks.buildContractSpaceAggregate.mockImplementation(async (inputs) => {
      const loader = await vi.importActual<
        typeof import('../../src/control-api/operations/contract-space-aggregate-loader')
      >('../../src/control-api/operations/contract-space-aggregate-loader');
      return loader.buildContractSpaceAggregate(
        inputs as Parameters<typeof loader.buildContractSpaceAggregate>[0],
      );
    });
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.writeContractSnapshot.mockResolvedValue({
      written: true,
      dir: '/tmp/test/migrations/snapshots/mock',
    });
  }, timeouts.typeScriptCompilation);

  afterEach(() => {
    cleanupMocks();
    vi.clearAllMocks();
  });

  // The repo-wide vitest config uses `isolate: false`, so every `vi.mock(...)`
  // registered above leaks into the next test file in the same worker (which
  // breaks anything that does real fs I/O against `node:fs/promises.readFile`,
  // `command-helpers.loadMigrationPackages`, or `migration-tools/io.writeMigrationPackage`).
  // Use `doUnmock` (non-hoisted) here so subsequent files see the real modules.
  afterAll(() => {
    vi.doUnmock('node:fs/promises');
    vi.doUnmock('@internal/config-loader');
    vi.doUnmock('../../src/utils/command-helpers');
    vi.doUnmock('@internal/migration-tools/refs');
    vi.doUnmock('@internal/migration-tools/io');
    vi.doUnmock('@internal/migration-tools/contract-snapshot-store');
    vi.doUnmock('@internal/migration-tools/migration-ts');
    vi.doUnmock('../../src/utils/framework-components');
    vi.doUnmock('../../src/control-api/operations/extract-sql-ddl');
    vi.doUnmock('@internal/framework-components/control');
    vi.doUnmock('../../src/control-api/operations/contract-space-seed-phase');
    vi.doUnmock('../../src/control-api/operations/contract-space-aggregate-loader');
    vi.resetModules();
  });

  describe('auto-baseline emission', () => {
    it('writes two app-space bundles with correct metadata on empty graph', async () => {
      setupAutoBaselineEmptyGraph();
      const command = createMigrationPlanCommand();
      const exitCode = await executeCommand(command, ['--json']);

      expect(exitCode).toBe(0);
      expect(mocks.writeMigrationPackage).toHaveBeenCalledTimes(2);

      const baselineMeta = mocks.writeMigrationPackage.mock.calls[0]![1] as {
        from: string | null;
        to: string;
      };
      const deltaMeta = mocks.writeMigrationPackage.mock.calls[1]![1] as {
        from: string | null;
        to: string;
      };
      expect(baselineMeta.from).toBeNull();
      expect(baselineMeta.to).toBe(OLD_HASH);
      expect(deltaMeta.from).toBe(OLD_HASH);
      expect(deltaMeta.to).toBe(NEW_HASH);

      // The baseline package's end contract and the delta package's start
      // contract are the same fromHash-keyed store entry (write-if-absent
      // makes the second call idempotent); the delta's destination is a
      // separate entry keyed by toHash.
      const snapshotHashes = mocks.writeContractSnapshot.mock.calls.map(([, hash]) => hash);
      expect(snapshotHashes).toEqual([OLD_HASH, NEW_HASH, OLD_HASH]);
      for (const call of mocks.writeContractSnapshot.mock.calls) {
        expect(call[0]).toBe('/tmp/test/migrations');
      }

      const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
      const result = JSON.parse(jsonLine!) as MigrationPlanResult;
      expect(result.baselineDir).toBeDefined();
      expect(result.dir).toBeDefined();
      expect(result.summary).toContain('Planned baseline +');
      expect(result.baselineDir! < result.dir!).toBe(true);
    });

    it('writes baseline-only bundle when fromHash equals toStorageHash on empty graph', async () => {
      const planMock = vi
        .fn()
        .mockReturnValueOnce(
          defaultPlannerSuccess([
            { id: 'baseline.table', label: 'Create baseline table', operationClass: 'additive' },
          ]),
        );
      setupBaseConfig(planMock);
      mocks.readFile.mockResolvedValue(makeContractJson(SAME_HASH));
      setupDbRefFromHash(SAME_HASH, []);
      mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);
      mocks.writeMigrationPackage.mockResolvedValue(undefined);

      const command = createMigrationPlanCommand();
      const exitCode = await executeCommand(command, ['--json']);

      expect(exitCode).toBe(0);
      expect(planMock).toHaveBeenCalledTimes(1);
      expect(mocks.writeMigrationPackage).toHaveBeenCalledTimes(1);

      const baselineMeta = mocks.writeMigrationPackage.mock.calls[0]![1] as {
        from: string | null;
        to: string;
      };
      expect(baselineMeta.from).toBeNull();
      expect(baselineMeta.to).toBe(SAME_HASH);

      const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
      const result = JSON.parse(jsonLine!) as MigrationPlanResult;
      expect(result.noOp).toBe(false);
      expect(result.baselineDir).toBeDefined();
      expect(result.dir).toBeUndefined();
      expect(result.from).toBe(SAME_HASH);
      expect(result.to).toBe(SAME_HASH);
      expect(result.summary).toContain('Planned baseline');
    });

    it('refuses without writing when baseline planner fails', async () => {
      const planMock = vi.fn().mockReturnValueOnce({
        kind: 'failure',
        conflicts: [{ kind: 'unsupportedChange', summary: 'baseline blocked' }],
      });
      setupBaseConfig(planMock);
      mocks.readFile.mockResolvedValue(makeContractJson(NEW_HASH));
      setupDbRefFromHash(OLD_HASH, []);
      mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);

      const command = createMigrationPlanCommand();
      await expect(executeCommand(command, ['--json'])).rejects.toThrow('process.exit called');

      expect(planMock).toHaveBeenCalledTimes(1);
      expect(mocks.writeMigrationPackage).not.toHaveBeenCalled();
    });

    it('keeps baseline on disk when delta planner fails after baseline succeeded', async () => {
      const planMock = vi
        .fn()
        .mockReturnValueOnce(
          defaultPlannerSuccess([
            { id: 'baseline.table', label: 'Baseline', operationClass: 'additive' },
          ]),
        )
        .mockReturnValueOnce({
          kind: 'failure',
          conflicts: [{ kind: 'unsupportedChange', summary: 'delta blocked' }],
        });
      setupBaseConfig(planMock);
      mocks.readFile.mockResolvedValue(makeContractJson(NEW_HASH));
      setupDbRefFromHash(OLD_HASH, []);
      mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);
      mocks.writeMigrationPackage.mockResolvedValue(undefined);
      mocks.mkdir.mockResolvedValue(undefined);
      mocks.writeFile.mockResolvedValue(undefined);

      const command = createMigrationPlanCommand();
      await expect(executeCommand(command, ['--json'])).rejects.toThrow('process.exit called');

      expect(planMock).toHaveBeenCalledTimes(2);
      expect(mocks.writeMigrationPackage).toHaveBeenCalledTimes(1);
      const baselineMeta = mocks.writeMigrationPackage.mock.calls[0]![1] as { from: string | null };
      expect(baselineMeta.from).toBeNull();
    });

    it('runs seed phase once and writes only app-space bundles when extension packs are declared', async () => {
      const planMock = vi
        .fn()
        .mockReturnValueOnce(
          defaultPlannerSuccess([{ id: 'b', label: 'Baseline', operationClass: 'additive' }]),
        )
        .mockReturnValueOnce(
          defaultPlannerSuccess([{ id: 'd', label: 'Delta', operationClass: 'additive' }]),
        );
      setupBaseConfig(planMock);
      mocks.loadConfig.mockResolvedValue(
        ok({
          family: {
            familyId: 'mongo',
            create: vi.fn().mockReturnValue({ deserializeContract: (c: unknown) => c }),
          },
          target: {
            id: 'mongo',
            familyId: 'mongo',
            targetId: 'mongo',
            kind: 'target',
            migrations: {
              createPlanner: vi.fn().mockReturnValue({ plan: planMock }),
              contractToSchema: vi.fn().mockReturnValue({}),
            },
          },
          adapter: {
            kind: 'adapter',
            familyId: 'mongo',
            targetId: 'mongo',
            create: () => ({ familyId: 'mongo', targetId: 'mongo' }),
          },
          contract: { output: '/tmp/test/contract.json' },
          migrations: { dir: '/tmp/test/migrations' },
          extensions: [
            {
              id: 'cipherstash',
              contractSpace: {
                contractJson: { v: 1 },
                headRef: { hash: OLD_HASH, invariants: [] },
                migrations: [],
              },
            },
          ],
        }),
      );
      mocks.runContractSpaceSeedPhase.mockResolvedValue({
        seeded: [
          {
            spaceId: 'cipherstash',
            action: 'updated',
            priorHash: null,
            newHash: OLD_HASH,
            newMigrationDirs: ['20260301_cipher'],
          },
        ],
      });
      // Hand-built aggregate in the new tolerant-space shape: `contract()`
      // and `graph()` are lazy methods, not eager values. `plan` only reads
      // `app.spaceId` and `app.contract()` here, so the extension space is
      // present for completeness but its facets are never invoked.
      mocks.buildContractSpaceAggregate.mockResolvedValueOnce(
        ok(
          createContractSpaceAggregate({
            targetId: 'mongo',
            app: createAggregateContractSpace({
              spaceId: 'app',
              packages: [],
              refs: {},
              headRef: { hash: NEW_HASH, invariants: [] },
              refsDir: REFS_DIR,
              migrationsDir: MIGRATIONS_DIR,
              resolveContract: () => JSON.parse(makeContractJson(NEW_HASH)) as Contract,
              deserializeContract: (c: unknown) => c as Contract,
            }),
            extensions: [
              createAggregateContractSpace({
                spaceId: 'cipherstash',
                packages: [],
                refs: {},
                headRef: { hash: OLD_HASH, invariants: [] },
                refsDir: REFS_DIR,
                migrationsDir: MIGRATIONS_DIR,
                resolveContract: () => JSON.parse(makeContractJson(OLD_HASH)) as Contract,
                deserializeContract: (c: unknown) => c as Contract,
              }),
            ],
            checkIntegrity: () => [],
          }),
        ),
      );
      mocks.readFile.mockResolvedValue(makeContractJson(NEW_HASH));
      setupDbRefFromHash(OLD_HASH, []);
      mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);
      mocks.writeMigrationPackage.mockResolvedValue(undefined);

      const command = createMigrationPlanCommand();
      const exitCode = await executeCommand(command, ['--json']);

      expect(exitCode).toBe(0);
      expect(mocks.runContractSpaceSeedPhase).toHaveBeenCalledTimes(1);
      expect(mocks.writeMigrationPackage).toHaveBeenCalledTimes(2);
      const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
      const result = JSON.parse(jsonLine!) as MigrationPlanResult;
      expect(result.emittedExtensionDirs).toEqual([
        { spaceId: 'cipherstash', dirName: '20260301_cipher' },
      ]);
    });
  });

  describe('no-op short-circuit', () => {
    it('returns noOp envelope without dir when hashes match', async () => {
      setupBaseConfig();
      mocks.readFile.mockResolvedValue(makeContractJson(SAME_HASH));
      const { bundles } = graphWithPriorMigration(SAME_HASH);
      setupDbRefFromHash(SAME_HASH, bundles);

      const command = createMigrationPlanCommand();
      const exitCode = await executeCommand(command, ['--json']);

      expect(exitCode).toBe(0);

      const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
      expect(jsonLine).toBeDefined();
      const result = JSON.parse(jsonLine!) as MigrationPlanResult;
      expect(result).toMatchObject({
        ok: true,
        noOp: true,
        from: SAME_HASH,
        to: SAME_HASH,
        operations: [],
        summary: 'No changes detected between contracts',
      });
      expect(result).not.toHaveProperty('dir');
      expect(mocks.writeMigrationTs).not.toHaveBeenCalled();
    });
  });

  describe('non-no-op plan', () => {
    it('scaffolds migration.ts from the planner result and reports operations', async () => {
      setupBaseConfig();
      mocks.readFile.mockResolvedValue(makeContractJson(NEW_HASH));
      const { bundles } = graphWithPriorMigration(OLD_HASH);
      setupDbRefFromHash(OLD_HASH, bundles);
      mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);
      mocks.writeMigrationPackage.mockResolvedValue(undefined);
      mocks.extractSqlDdl.mockReturnValue([]);

      const command = createMigrationPlanCommand();
      const exitCode = await executeCommand(command, ['--json']);

      expect(exitCode).toBe(0);
      expect(mocks.writeMigrationTs).toHaveBeenCalledTimes(1);

      const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
      expect(jsonLine).toBeDefined();
      const result = JSON.parse(jsonLine!) as MigrationPlanResult;
      expect(result).toMatchObject({
        ok: true,
        noOp: false,
        from: OLD_HASH,
        to: NEW_HASH,
        operations: [
          { id: 'table.user', label: 'Create table "user"', operationClass: 'additive' },
        ],
      });
      expect(result).not.toHaveProperty('migrationHash');

      // With no --from flag, resolution goes through the named 'db' ref
      // (ref provenance), which carries its own contract snapshot —
      // migration plan writes both the destination and that start snapshot.
      expect(mocks.writeContractSnapshot).toHaveBeenCalledTimes(2);
      expect(mocks.writeContractSnapshot).toHaveBeenCalledWith(
        '/tmp/test/migrations',
        NEW_HASH,
        expect.anything(),
      );
      expect(mocks.writeContractSnapshot).toHaveBeenCalledWith('/tmp/test/migrations', OLD_HASH, {
        contractJson: JSON.parse(makeContractJson(OLD_HASH)),
        contractDts: 'export type Contract = unknown;\n',
      });
    });
  });

  describe('placeholder handling', () => {
    function setupClassBasedConfig(planOperationsGetter: () => unknown[]): void {
      const planMock = vi.fn().mockReturnValue({
        kind: 'success',
        plan: {
          get operations() {
            return planOperationsGetter();
          },
          renderTypeScript: () => '// migration.ts with placeholder',
        },
      });
      const createPlannerMock = vi.fn().mockReturnValue({ plan: planMock });
      const contractToSchemaMock = vi.fn().mockReturnValue({ tables: {} });

      mocks.loadConfig.mockResolvedValue(
        ok({
          family: {
            familyId: 'sql',
            create: vi.fn().mockReturnValue({
              deserializeContract: (c: unknown) => c,
            }),
          },
          target: {
            id: 'postgres',
            familyId: 'sql',
            targetId: 'postgres',
            kind: 'target',
            migrations: {
              createPlanner: createPlannerMock,
              createRunner: vi.fn(),
              contractToSchema: contractToSchemaMock,
              emit: vi.fn(),
            },
          },
          adapter: {
            kind: 'adapter',
            familyId: 'sql',
            targetId: 'postgres',
            create: () => ({ familyId: 'sql', targetId: 'postgres' }),
          },
          contract: { output: '/tmp/test/contract.json' },
          migrations: { dir: '/tmp/test/migrations' },
        }),
      );
      mocks.createControlStack.mockReturnValue({});
    }

    it('returns pendingPlaceholders result when plan.operations throws MIGRATION.UNFILLED_PLACEHOLDER', async () => {
      setupClassBasedConfig(() => {
        throw errorUnfilledPlaceholder('backfill-users-status:check');
      });

      const NEW_HASH = `${'n'.repeat(64)}`;

      mocks.readFile.mockResolvedValue(makeContractJson(NEW_HASH, 'postgres'));
      const { bundles } = graphWithPriorMigration(OLD_HASH);
      setupDbRefFromHash(OLD_HASH, bundles);
      mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);
      mocks.writeMigrationPackage.mockResolvedValue(undefined);

      const command = createMigrationPlanCommand();
      const exitCode = await executeCommand(command, ['--json']);

      expect(exitCode).toBe(0);

      const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
      expect(jsonLine).toBeDefined();
      const result = JSON.parse(jsonLine!) as MigrationPlanResult;
      expect(result).toMatchObject({
        ok: true,
        noOp: false,
        from: OLD_HASH,
        to: NEW_HASH,
        pendingPlaceholders: true,
      });
      expect(result.summary).toContain('placeholder');
      expect(result.dir).toBeDefined();
    });

    it('writes migration.ts and returns pendingPlaceholders when placeholders are present', async () => {
      setupClassBasedConfig(() => {
        throw errorUnfilledPlaceholder('backfill-users-status:run');
      });

      mocks.readFile.mockResolvedValue(makeContractJson(`${'c'.repeat(64)}`, 'postgres'));
      const { bundles } = graphWithPriorMigration(`${'b'.repeat(64)}`);
      setupDbRefFromHash(`${'b'.repeat(64)}`, bundles);
      mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);
      mocks.writeMigrationPackage.mockResolvedValue(undefined);

      const command = createMigrationPlanCommand();
      await executeCommand(command, ['--json']);

      expect(mocks.writeMigrationTs).toHaveBeenCalledTimes(1);
    });
  });

  describe('--to arbitrary destination', () => {
    it('plans a reverse delta toward the resolved target, flags it destructive, and does not refuse', async () => {
      // Current emitted contract is the tip (NEW_HASH); --to rolls back to the
      // baseline (OLD_HASH). The planner returns a DROP op: a clean rollback
      // plans successfully with a destructive warning rather than refusing.
      const planMock = vi
        .fn()
        .mockReturnValue(
          defaultPlannerSuccess([
            { id: 'table.comment', label: 'Drop table "comment"', operationClass: 'destructive' },
          ]),
        );
      setupBaseConfig(planMock);
      mocks.readFile.mockResolvedValue(makeContractJson(NEW_HASH));
      const { bundles } = graphWithTwoMigrations(OLD_HASH, NEW_HASH);
      setupResolutionAggregate(bundles, {
        db: { hash: NEW_HASH, invariants: [] },
        staging: { hash: OLD_HASH, invariants: [] },
      });
      mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);
      mocks.writeMigrationPackage.mockResolvedValue(undefined);
      mocks.extractSqlDdl.mockReturnValue([]);

      const command = createMigrationPlanCommand();
      const exitCode = await executeCommand(command, ['--json', '--to', 'staging']);

      expect(exitCode).toBe(0);
      const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
      const result = JSON.parse(jsonLine!) as MigrationPlanResult;
      expect(result.from).toBe(NEW_HASH);
      expect(result.to).toBe(OLD_HASH);
      expect(result.operations).toEqual([
        { id: 'table.comment', label: 'Drop table "comment"', operationClass: 'destructive' },
      ]);
      // The destination snapshot is written from the resolved target's raw
      // artifacts (via contractAt), not read back from the emitted
      // contract.json.
      expect(mocks.writeContractSnapshot).toHaveBeenCalledWith('/tmp/test/migrations', OLD_HASH, {
        contractJson: JSON.parse(makeContractJson(OLD_HASH)),
        contractDts: 'export type Contract = unknown;\n',
      });
    });

    it('renders the destructive-operations warning for a reverse delta', async () => {
      const planMock = vi
        .fn()
        .mockReturnValue(
          defaultPlannerSuccess([
            { id: 'table.comment', label: 'Drop table "comment"', operationClass: 'destructive' },
          ]),
        );
      setupBaseConfig(planMock);
      mocks.readFile.mockResolvedValue(makeContractJson(NEW_HASH));
      const { bundles } = graphWithTwoMigrations(OLD_HASH, NEW_HASH);
      setupResolutionAggregate(bundles, {
        db: { hash: NEW_HASH, invariants: [] },
        staging: { hash: OLD_HASH, invariants: [] },
      });
      mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);
      mocks.writeMigrationPackage.mockResolvedValue(undefined);
      mocks.extractSqlDdl.mockReturnValue([]);

      const command = createMigrationPlanCommand();
      const exitCode = await executeCommand(command, ['--to', 'staging']);

      expect(exitCode).toBe(0);
      const rendered = consoleOutput.join('\n');
      expect(rendered).toContain('destructive operations that may cause data loss');
    });

    it('resolves an explicit --from and --to independently', async () => {
      setupBaseConfig();
      mocks.readFile.mockImplementation(async (path: string) => {
        if (typeof path === 'string' && path.endsWith('predecessor-snapshot.json')) {
          return makeContractJson(OLD_HASH);
        }
        return makeContractJson(NEW_HASH);
      });
      const { bundles } = graphWithTwoMigrations(OLD_HASH, NEW_HASH);
      setupResolutionAggregate(bundles, { staging: { hash: NEW_HASH, invariants: [] } });
      mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);
      mocks.writeMigrationPackage.mockResolvedValue(undefined);
      mocks.extractSqlDdl.mockReturnValue([]);

      const command = createMigrationPlanCommand();
      const exitCode = await executeCommand(command, [
        '--json',
        '--from',
        OLD_HASH,
        '--to',
        'staging',
      ]);

      expect(exitCode).toBe(0);
      const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
      const result = JSON.parse(jsonLine!) as MigrationPlanResult;
      expect(result.from).toBe(OLD_HASH);
      expect(result.to).toBe(NEW_HASH);
      // An explicit --from that resolves to a graph node relies on the
      // predecessor's end contract already being in the store under its own
      // hash — migration plan writes no predecessor snapshot for it.
      expect(mocks.writeContractSnapshot).not.toHaveBeenCalledWith(
        '/tmp/test/migrations',
        OLD_HASH,
        expect.anything(),
      );
      // The destination snapshot comes from the resolved --to target.
      expect(mocks.writeContractSnapshot).toHaveBeenCalledWith('/tmp/test/migrations', NEW_HASH, {
        contractJson: JSON.parse(makeContractJson(NEW_HASH)),
        contractDts: 'export type Contract = unknown;\n',
      });
    });

    it('preserves the emitted contract.json as the destination when --to is omitted', async () => {
      setupBaseConfig();
      mocks.readFile.mockResolvedValue(makeContractJson(NEW_HASH));
      const { bundles } = graphWithPriorMigration(OLD_HASH);
      setupDbRefFromHash(OLD_HASH, bundles);
      mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);
      mocks.writeMigrationPackage.mockResolvedValue(undefined);
      mocks.extractSqlDdl.mockReturnValue([]);

      const command = createMigrationPlanCommand();
      const exitCode = await executeCommand(command, ['--json']);

      expect(exitCode).toBe(0);
      const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
      const result = JSON.parse(jsonLine!) as MigrationPlanResult;
      expect(result.to).toBe(NEW_HASH);
      // With no `--to`, the destination snapshot is read from the emitted
      // contract.json / contract.d.ts rather than a resolved ref.
      expect(mocks.writeContractSnapshot).toHaveBeenCalledWith('/tmp/test/migrations', NEW_HASH, {
        contractJson: JSON.parse(makeContractJson(NEW_HASH)),
        contractDts: makeContractJson(NEW_HASH),
      });
    });
  });

  describe('contract snapshot store writes', () => {
    it('writes only the destination snapshot when there is no prior migration', async () => {
      setupBaseConfig();
      const NEW_HASH = 'd'.repeat(64);

      mocks.readFile.mockResolvedValue(makeContractJson(NEW_HASH));
      setupGreenfieldRefs();
      mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);
      mocks.writeMigrationPackage.mockResolvedValue(undefined);
      mocks.extractSqlDdl.mockReturnValue([]);

      const command = createMigrationPlanCommand();
      await executeCommand(command, ['--json']);

      expect(mocks.writeContractSnapshot).toHaveBeenCalledTimes(1);
      expect(mocks.writeContractSnapshot).toHaveBeenCalledWith('/tmp/test/migrations', NEW_HASH, {
        contractJson: JSON.parse(makeContractJson(NEW_HASH)),
        contractDts: makeContractJson(NEW_HASH),
      });
    });

    it('writes only the destination snapshot when --from resolves via graph node (the predecessor is already in the store)', async () => {
      setupBaseConfig();
      mocks.readFile.mockImplementation(async (path: string) => {
        if (typeof path === 'string' && path.endsWith('predecessor-snapshot.json')) {
          return makeContractJson(OLD_HASH);
        }
        return makeContractJson(NEW_HASH);
      });
      const { bundles } = graphWithPriorMigration(OLD_HASH);
      setupResolutionAggregate(bundles, {});
      mocks.assertFrameworkComponentsCompatible.mockReturnValue([]);
      mocks.writeMigrationPackage.mockResolvedValue(undefined);
      mocks.extractSqlDdl.mockReturnValue([]);

      const command = createMigrationPlanCommand();
      await executeCommand(command, ['--json', '--from', OLD_HASH]);

      expect(mocks.writeContractSnapshot).toHaveBeenCalledTimes(1);
      expect(mocks.writeContractSnapshot).toHaveBeenCalledWith('/tmp/test/migrations', NEW_HASH, {
        contractJson: JSON.parse(makeContractJson(NEW_HASH)),
        contractDts: makeContractJson(NEW_HASH),
      });
    });

    it('surfaces a structured file-not-found error when the predecessor snapshot is missing', async () => {
      // Locks the spec acceptance criterion for TML-2512: `migration plan`
      // must surface a clear structured CLI error (not a raw ENOENT crash)
      // when it cannot read the previous migration's destination contract
      // snapshot.
      const { consoleErrors, consoleOutput: localConsoleOutput } = setupCommandMocks({
        isTTY: false,
      });
      setupBaseConfig();

      mocks.readFile.mockImplementation(async (path: string) => {
        if (typeof path === 'string' && path.endsWith('predecessor-snapshot.json')) {
          const err = new Error(`ENOENT: no such file or directory, open '${path}'`) as Error & {
            code: string;
          };
          err.code = 'ENOENT';
          throw err;
        }
        return makeContractJson(NEW_HASH);
      });
      const { bundles } = graphWithPriorMigration(OLD_HASH);
      setupResolutionAggregate(bundles, {});

      const command = createMigrationPlanCommand();
      await expect(executeCommand(command, ['--json', '--from', OLD_HASH])).rejects.toThrow(
        'process.exit called',
      );

      const message = [...localConsoleOutput, ...consoleErrors].join('\n');
      expect(message).toContain('predecessor-snapshot.json');
      expect(message).toContain('20260301T0900_prev');
      expect(message).toContain(
        'Restore migrations/snapshots/ from version control, or re-run the command that produced this migration to regenerate its snapshot.',
      );
    });
  });
});
