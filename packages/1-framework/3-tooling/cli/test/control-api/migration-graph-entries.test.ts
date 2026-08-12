import { mkdir, rm } from 'node:fs/promises';
import type { Contract } from '@internal/contract/types';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { loadContractSpaceAggregate } from '@internal/migration-tools/aggregate';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { writeRef } from '@internal/migration-tools/refs';
import { createSqlContract } from '@repo/test-utils';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildMigrationSpaceGraphEntries } from '../../src/control-api/operations/migration-graph';
import { createTestProjectDir } from '../utils/test-project-dir';

const HASH_A = `${'a'.repeat(64)}`;

const APP_CONTRACT = createSqlContract({
  target: 'postgres',
  storage: {
    namespaces: {
      [UNBOUND_NAMESPACE_ID]: {
        id: UNBOUND_NAMESPACE_ID,
        entries: {
          table: { user: { columns: { id: {} } } },
        },
      },
    },
  },
}) as Contract;

const identityDeserialize = (json: unknown): Contract => json as Contract;

describe('buildMigrationSpaceGraphEntries', () => {
  let migrationsDir: string;

  beforeEach(async () => {
    migrationsDir = createTestProjectDir('migration-graph-entries');
    await mkdir(join(migrationsDir, 'app'), { recursive: true });
  });

  afterEach(async () => {
    await rm(migrationsDir, { recursive: true, force: true });
  });

  async function seedBaseline(): Promise<{ dirName: string; migrationHash: string }> {
    const timestamp = new Date(2026, 0, 1, 10, 0);
    const baseMetadata: Omit<MigrationMetadata, 'migrationHash'> = {
      from: null,
      to: HASH_A,
      providedInvariants: [],
      createdAt: timestamp.toISOString(),
    };
    const ops: MigrationPlanOperation[] = [
      { id: 'table.user', label: 'Create table "user"', operationClass: 'additive' },
    ];
    const migrationHash = computeMigrationHash(baseMetadata, ops);
    const dirName = '20260101100000_baseline';
    await writeMigrationPackage(
      join(migrationsDir, 'app', dirName),
      {
        ...baseMetadata,
        migrationHash,
      },
      ops,
    );
    return { dirName, migrationHash };
  }

  it('projects EMPTY-from edges as null and decorates contracts with refs', async () => {
    const { dirName, migrationHash } = await seedBaseline();
    await writeRef(join(migrationsDir, 'app', 'refs'), 'staging', {
      hash: HASH_A,
      invariants: [],
    });
    const aggregate = await loadContractSpaceAggregate({
      migrationsDir,
      appContract: APP_CONTRACT,
      deserializeContract: identityDeserialize,
    });

    const entries = buildMigrationSpaceGraphEntries({
      aggregate,
      scopedSpaces: [{ space: 'app', migrations: [] }],
    });

    expect(entries).toEqual([
      {
        space: 'app',
        contracts: [
          { hash: EMPTY_CONTRACT_HASH, refs: [] },
          { hash: HASH_A, refs: ['staging'] },
        ],
        migrations: [
          {
            name: dirName,
            hash: migrationHash,
            fromContract: null,
            toContract: HASH_A,
          },
        ],
      },
    ]);
  });

  it('skips space ids the aggregate no longer resolves', async () => {
    await seedBaseline();
    const aggregate = await loadContractSpaceAggregate({
      migrationsDir,
      appContract: APP_CONTRACT,
      deserializeContract: identityDeserialize,
    });

    const entries = buildMigrationSpaceGraphEntries({
      aggregate,
      scopedSpaces: [
        { space: 'ghost', migrations: [] },
        { space: 'app', migrations: [] },
      ],
    });

    expect(entries.map((e) => e.space)).toEqual(['app']);
  });
});
