import { rmSync } from 'node:fs';
import type { Contract, ContractMarkerRecord } from '@internal/contract/types';
import type {
  ControlAdapterInstance,
  ControlDriverInstance,
  ControlExtensionDescriptor,
  ControlFamilyInstance,
  MigrationPlanOperation,
  TargetMigrationsCapability,
} from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { writeContractSnapshot } from '@internal/migration-tools/contract-snapshot-store';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { writeRef } from '@internal/migration-tools/refs';
import { createSqlContract } from '@repo/test-utils';
import { join } from 'pathe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeDbInit } from '../../src/control-api/operations/db-init';
import { createTestProjectDir } from '../utils/test-project-dir';

const TEST_INVOCATION = { cwd: '/work/app', configPath: undefined, dbGiven: false };

const AUDIT_SPACE = 'audit';
const STRAY_HASH = 'c'.repeat(64);

const AUDIT_CONTRACT: Contract = createSqlContract({
  storage: {
    namespaces: {
      [UNBOUND_NAMESPACE_ID]: { id: UNBOUND_NAMESPACE_ID, entries: { table: { audit_log: {} } } },
    },
  },
});
const AUDIT_HEAD = AUDIT_CONTRACT.storage.storageHash;
const AUDIT_OPS: readonly MigrationPlanOperation[] = [
  { id: 'table.audit_log', label: 'Create table audit_log', operationClass: 'additive' },
];
const AUDIT_METADATA: Omit<MigrationMetadata, 'migrationHash'> = {
  from: EMPTY_CONTRACT_HASH,
  to: AUDIT_HEAD,
  providedInvariants: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const auditExtension: ControlExtensionDescriptor<'sql', 'postgres'> = {
  kind: 'extension',
  id: AUDIT_SPACE,
  familyId: 'sql',
  targetId: 'postgres',
  version: '1.0.0',
  contractSpace: {
    contractJson: AUDIT_CONTRACT,
    headRef: { hash: AUDIT_HEAD, invariants: [] },
    migrations: [
      {
        dirName: '20260101T0000_init',
        metadata: {
          ...AUDIT_METADATA,
          migrationHash: computeMigrationHash(AUDIT_METADATA, AUDIT_OPS),
        },
        ops: AUDIT_OPS,
      },
    ],
  },
  create: () => ({ familyId: 'sql', targetId: 'postgres' }),
};

const strayMarker: ContractMarkerRecord = {
  storageHash: STRAY_HASH,
  profileHash: '',
  contractJson: null,
  canonicalVersion: null,
  updatedAt: new Date(0),
  appTag: null,
  meta: {},
  invariants: [],
};

const family = {
  familyId: 'sql',
  readAllMarkers: async () => new Map([[AUDIT_SPACE, strayMarker]]),
  introspect: async () => ({ tables: {} }),
  deserializeContract: (json: unknown) => json as Contract,
  storageNameOf: (operation: MigrationPlanOperation) => operation.id,
} as unknown as ControlFamilyInstance<'sql', unknown>;

const migrations = {
  createPlanner: () => ({ plan: vi.fn() }),
  createRunner: () => ({ execute: vi.fn() }),
} as unknown as TargetMigrationsCapability<
  'sql',
  'postgres',
  ControlFamilyInstance<'sql', unknown>
>;

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** An audit extension space whose one migration starts from the empty contract. */
async function migrationsDirWithExtension(): Promise<string> {
  const dir = createTestProjectDir('db-run-planner-errors');
  tempDirs.push(dir);
  const migrationsDir = join(dir, 'migrations');
  await writeContractSnapshot(migrationsDir, AUDIT_HEAD, {
    contractJson: AUDIT_CONTRACT,
    contractDts: '',
  });
  await writeMigrationPackage(
    join(migrationsDir, AUDIT_SPACE, '20260101T0000_init'),
    { ...AUDIT_METADATA, migrationHash: computeMigrationHash(AUDIT_METADATA, AUDIT_OPS) },
    AUDIT_OPS,
  );
  await writeRef(join(migrationsDir, AUDIT_SPACE, 'refs'), 'head', {
    hash: AUDIT_HEAD,
    invariants: [],
  });
  return migrationsDir;
}

describe('db init, an extension space whose marker no migration path leaves', () => {
  it('reports MIGRATION.PATH_UNREACHABLE naming the space, its marker and its head', async () => {
    const result = await executeDbInit({
      invocation: TEST_INVOCATION,
      driver: { close: vi.fn() } as unknown as ControlDriverInstance<'sql', 'postgres'>,
      adapter: {} as unknown as ControlAdapterInstance<'sql', 'postgres'>,
      familyInstance: family,
      contract: createSqlContract(),
      mode: 'plan',
      migrations,
      frameworkComponents: [],
      migrationsDir: await migrationsDirWithExtension(),
      targetId: 'postgres',
      extensions: [auditExtension],
    });

    expect(
      result.ok
        ? undefined
        : { code: result.failure.code, message: result.failure.message, meta: result.failure.meta },
    ).toEqual({
      code: 'MIGRATION.PATH_UNREACHABLE',
      message: `Cannot resolve apply path for extension space "${AUDIT_SPACE}"`,
      meta: { spaceId: AUDIT_SPACE, fromHash: STRAY_HASH, target: AUDIT_HEAD },
    });
  });
});
