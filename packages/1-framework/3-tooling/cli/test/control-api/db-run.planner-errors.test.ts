import { rmSync } from 'node:fs';
import type { Contract, ContractMarkerRecord } from '@internal/contract/types';
import type {
  ControlAdapterInstance,
  ControlDriverInstance,
  ControlExtensionDescriptor,
  ControlFamilyInstance,
  MigrationPackage,
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
const SIDE_HASH = 'd'.repeat(64);
const BRANCH_HASH = 'e'.repeat(64);

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

function migrationPackage(
  dirName: string,
  from: string,
  to: string,
  invariantId: string | undefined = undefined,
): MigrationPackage {
  const ops: readonly MigrationPlanOperation[] =
    invariantId === undefined
      ? AUDIT_OPS
      : [{ id: 'data.backfill', label: 'Backfill audit_log', operationClass: 'data', invariantId }];
  const metadata: Omit<MigrationMetadata, 'migrationHash'> = {
    from,
    to,
    providedInvariants: invariantId === undefined ? [] : [invariantId],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  return {
    dirName,
    metadata: { ...metadata, migrationHash: computeMigrationHash(metadata, ops) },
    ops,
  };
}

/** An audit extension space with `packages`, whose head ref requires `invariants`. */
interface AuditSpace {
  readonly packages: readonly MigrationPackage[];
  readonly invariants: readonly string[];
}

function auditExtension(space: AuditSpace): ControlExtensionDescriptor<'sql', 'postgres'> {
  return {
    kind: 'extension',
    id: AUDIT_SPACE,
    familyId: 'sql',
    targetId: 'postgres',
    version: '1.0.0',
    contractSpace: {
      contractJson: AUDIT_CONTRACT,
      headRef: { hash: AUDIT_HEAD, invariants: space.invariants },
      migrations: space.packages,
    },
    create: () => ({ familyId: 'sql', targetId: 'postgres' }),
  };
}

function markerAt(storageHash: string): ContractMarkerRecord {
  return {
    storageHash,
    profileHash: '',
    contractJson: null,
    canonicalVersion: null,
    updatedAt: new Date(0),
    appTag: null,
    meta: {},
    invariants: [],
  };
}

function familyWithAuditMarker(hash: string) {
  return {
    familyId: 'sql',
    readAllMarkers: async () => new Map([[AUDIT_SPACE, markerAt(hash)]]),
    introspect: async () => ({ tables: {} }),
    deserializeContract: (json: unknown) => json as Contract,
    storageNameOf: (operation: MigrationPlanOperation) => operation.id,
  } as unknown as ControlFamilyInstance<'sql', unknown>;
}

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

async function migrationsDirWith(space: AuditSpace): Promise<string> {
  const dir = createTestProjectDir('db-run-planner-errors');
  tempDirs.push(dir);
  const migrationsDir = join(dir, 'migrations');
  await writeContractSnapshot(migrationsDir, AUDIT_HEAD, {
    contractJson: AUDIT_CONTRACT,
    contractDts: '',
  });
  for (const pkg of space.packages) {
    await writeMigrationPackage(
      join(migrationsDir, AUDIT_SPACE, pkg.dirName),
      pkg.metadata,
      pkg.ops,
    );
  }
  await writeRef(join(migrationsDir, AUDIT_SPACE, 'refs'), 'head', {
    hash: AUDIT_HEAD,
    invariants: space.invariants,
  });
  return migrationsDir;
}

async function dbInitPlan(space: AuditSpace, markerHash: string) {
  return executeDbInit({
    invocation: TEST_INVOCATION,
    driver: { close: vi.fn() } as unknown as ControlDriverInstance<'sql', 'postgres'>,
    adapter: {} as unknown as ControlAdapterInstance<'sql', 'postgres'>,
    familyInstance: familyWithAuditMarker(markerHash),
    contract: createSqlContract(),
    mode: 'plan',
    migrations,
    frameworkComponents: [],
    migrationsDir: await migrationsDirWith(space),
    targetId: 'postgres',
    extensions: [auditExtension(space)],
  });
}

describe('db init, an extension space whose marker no migration path leaves', () => {
  it('reports MIGRATION.PATH_UNREACHABLE naming the space, its marker and its head', async () => {
    const result = await dbInitPlan(
      {
        packages: [migrationPackage('20260101T0000_init', EMPTY_CONTRACT_HASH, AUDIT_HEAD)],
        invariants: [],
      },
      STRAY_HASH,
    );

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

describe('db init, an extension space whose path from its marker misses a required invariant', () => {
  it('refuses with MIGRATION.NO_INVARIANT_PATH, naming the invariant and the path it would take', async () => {
    const side = migrationPackage('20260101T0000_side', EMPTY_CONTRACT_HASH, SIDE_HASH);
    const tail = migrationPackage('20260102T0000_tail', SIDE_HASH, AUDIT_HEAD);
    const space: AuditSpace = {
      packages: [
        side,
        tail,
        migrationPackage('20260101T0000_branch', EMPTY_CONTRACT_HASH, BRANCH_HASH),
        migrationPackage('20260102T0000_backfill', BRANCH_HASH, AUDIT_HEAD, 'audit-backfilled'),
      ],
      invariants: ['audit-backfilled'],
    };

    await expect(dbInitPlan(space, SIDE_HASH)).rejects.toMatchObject({
      code: 'MIGRATION.NO_INVARIANT_PATH',
      meta: {
        required: ['audit-backfilled'],
        missing: ['audit-backfilled'],
        structuralPath: [
          {
            dirName: tail.dirName,
            migrationHash: tail.metadata.migrationHash,
            from: SIDE_HASH,
            to: AUDIT_HEAD,
            invariants: [],
          },
        ],
      },
    });
  });
});
