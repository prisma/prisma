import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { contractSnapshotDir } from '@internal/migration-tools/contract-snapshot-store';
import { MigrationToolsError } from '@internal/migration-tools/errors';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type ContractIR,
  computeRefAdvancementName,
  executeRefAdvancement,
} from '../../src/utils/ref-advancement';

const HASH_A = `${'a'.repeat(64)}`;
const PROFILE_HASH = `${'c'.repeat(64)}`;

function sampleContractIR(storageHash: string = HASH_A): ContractIR {
  return {
    contract: {
      schemaVersion: '1',
      targetFamily: 'sql',
      target: 'postgres',
      profileHash: PROFILE_HASH,
      storage: { storageHash },
      models: {
        User: {
          fields: {
            id: {
              nullable: false,
              type: { kind: 'scalar', codecId: 'sql/int4@1' },
            },
          },
          relations: {},
          storage: { namespaceId: '__unbound__', table: 'users', namespace: 'public' },
        },
      },
      roots: {},
    },
    contractDts: '// generated\nexport type Contract = unknown;\n',
  };
}

function refPointerPath(refsDir: string, name: string): string {
  return join(refsDir, `${name}.json`);
}

describe('computeRefAdvancementName', () => {
  it('returns the explicit name when advanceRef is set without db', () => {
    expect(computeRefAdvancementName({ advanceRef: 'staging' })).toBe('staging');
  });

  it('returns the explicit name when advanceRef is set with db', () => {
    expect(
      computeRefAdvancementName({ advanceRef: 'staging', db: 'postgres://localhost/db' }),
    ).toBe('staging');
  });

  it('returns db when advanceRef is omitted and db is omitted', () => {
    expect(computeRefAdvancementName({})).toBe('db');
  });

  it('returns null when advanceRef is omitted and db is provided', () => {
    expect(computeRefAdvancementName({ db: 'postgres://localhost/db' })).toBe(null);
  });

  it('returns db when advanceRef is explicitly db on the default database', () => {
    expect(computeRefAdvancementName({ advanceRef: 'db' })).toBe('db');
  });
});

describe('executeRefAdvancement', () => {
  let migrationsDir: string;
  let refsDir: string;

  beforeEach(async () => {
    migrationsDir = join(
      tmpdir(),
      `test-ref-advancement-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    refsDir = join(migrationsDir, 'app', 'refs');
  });

  afterEach(async () => {
    await rm(migrationsDir, { recursive: true, force: true });
  });

  it('writes the store entry and pointer, returning the advanced ref', async () => {
    expect(existsSync(refsDir)).toBe(false);

    const result = await executeRefAdvancement(
      refsDir,
      migrationsDir,
      'db',
      HASH_A,
      sampleContractIR(),
    );

    expect(result).toEqual({ name: 'db', hash: HASH_A });
    expect(existsSync(refPointerPath(refsDir, 'db'))).toBe(true);
    expect(existsSync(join(contractSnapshotDir(migrationsDir, HASH_A), 'contract.json'))).toBe(
      true,
    );
    expect(existsSync(join(contractSnapshotDir(migrationsDir, HASH_A), 'contract.d.ts'))).toBe(
      true,
    );
  });

  it('is a write-if-absent no-op on the store when advancing to the same hash again', async () => {
    await executeRefAdvancement(refsDir, migrationsDir, 'db', HASH_A, sampleContractIR());
    const storeJsonPath = join(contractSnapshotDir(migrationsDir, HASH_A), 'contract.json');
    const firstContent = await readFile(storeJsonPath, 'utf-8');

    await executeRefAdvancement(refsDir, migrationsDir, 'db', HASH_A, sampleContractIR());
    const secondContent = await readFile(storeJsonPath, 'utf-8');

    expect(secondContent).toBe(firstContent);
  });

  it('propagates a hash mismatch between the argument and the contract IR from the store write', async () => {
    const HASH_B = 'b'.repeat(64);
    await expect(
      executeRefAdvancement(refsDir, migrationsDir, 'db', HASH_A, sampleContractIR(HASH_B)),
    ).rejects.toSatisfy((error) => {
      expect(MigrationToolsError.is(error)).toBe(true);
      expect((error as MigrationToolsError).code).toBe('MIGRATION.CONTRACT_SNAPSHOT_HASH_MISMATCH');
      return true;
    });
    expect(existsSync(refPointerPath(refsDir, 'db'))).toBe(false);
  });

  it('surfaces MIGRATION.INVALID_REF_NAME for an invalid ref name without writing a store entry', async () => {
    await expect(
      executeRefAdvancement(refsDir, migrationsDir, '', HASH_A, sampleContractIR()),
    ).rejects.toSatisfy((error) => {
      expect(MigrationToolsError.is(error)).toBe(true);
      expect((error as MigrationToolsError).code).toBe('MIGRATION.INVALID_REF_NAME');
      return true;
    });
    expect(existsSync(contractSnapshotDir(migrationsDir, HASH_A))).toBe(false);
  });
});
