import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { contractSnapshotDir } from '@internal/migration-tools/contract-snapshot-store';
import { errorInvalidRefName, MigrationToolsError } from '@internal/migration-tools/errors';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  advanceRefSafely,
  type ContractIR,
  computeRefAdvancementName,
  executeRefAdvancement,
  resolveRefAdvancementFields,
} from '../../src/control-api/operations/ref-advancement';

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

describe('resolveRefAdvancementFields', () => {
  let tempDir: string;
  let migrationsDir: string;
  let refsDir: string;
  let contractJsonPath: string;
  const contractIR = sampleContractIR();
  const contractJson = contractIR.contract as Record<string, unknown>;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `test-resolve-ref-advancement-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    migrationsDir = join(tempDir, 'migrations');
    refsDir = join(migrationsDir, 'app', 'refs');
    await mkdir(tempDir, { recursive: true });
    contractJsonPath = join(tempDir, 'contract.json');
    await writeFile(contractJsonPath, JSON.stringify(contractJson));
    await writeFile(join(tempDir, 'contract.d.ts'), contractIR.contractDts);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('is a no-op when the computed advancement name is null', async () => {
    const result = await resolveRefAdvancementFields({
      db: 'postgres://localhost/db',
      refsDir,
      migrationsDir,
      contractJson,
      contractJsonPath,
      mode: 'apply',
      hash: HASH_A,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ advancedRef: null, plannedAdvanceRef: null });
    }
    expect(existsSync(refsDir)).toBe(false);
  });

  it('plans without writing in plan mode', async () => {
    const result = await resolveRefAdvancementFields({
      advanceRef: 'staging',
      refsDir,
      migrationsDir,
      contractJson,
      contractJsonPath,
      mode: 'plan',
      hash: HASH_A,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        advancedRef: null,
        plannedAdvanceRef: { name: 'staging', hash: HASH_A },
      });
    }
    expect(existsSync(refPointerPath(refsDir, 'staging'))).toBe(false);
  });

  it('advances the ref in apply mode, writing store entry and pointer', async () => {
    const result = await resolveRefAdvancementFields({
      advanceRef: 'staging',
      refsDir,
      migrationsDir,
      contractJson,
      contractJsonPath,
      mode: 'apply',
      hash: HASH_A,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        advancedRef: { name: 'staging', hash: HASH_A },
        plannedAdvanceRef: null,
      });
    }
    expect(existsSync(refPointerPath(refsDir, 'staging'))).toBe(true);
    expect(existsSync(join(contractSnapshotDir(migrationsDir, HASH_A), 'contract.json'))).toBe(
      true,
    );
  });

  it('maps an invalid ref name to the MigrationToolsError envelope without writing', async () => {
    const result = await resolveRefAdvancementFields({
      advanceRef: 'Invalid Name',
      refsDir,
      migrationsDir,
      contractJson,
      contractJsonPath,
      mode: 'apply',
      hash: HASH_A,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.toEnvelope()).toEqual(errorInvalidRefName('Invalid Name').toEnvelope());
    }
    expect(existsSync(contractSnapshotDir(migrationsDir, HASH_A))).toBe(false);
  });
});

describe('advanceRefSafely', () => {
  let migrationsDir: string;
  let refsDir: string;

  beforeEach(() => {
    migrationsDir = join(
      tmpdir(),
      `test-advance-ref-safely-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    refsDir = join(migrationsDir, 'app', 'refs');
  });

  afterEach(async () => {
    await rm(migrationsDir, { recursive: true, force: true });
  });

  it('advances the named ref and returns its name and hash', async () => {
    const result = await advanceRefSafely({
      refsDir,
      migrationsDir,
      name: 'production',
      hash: HASH_A,
      contractIR: sampleContractIR(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ name: 'production', hash: HASH_A });
    }
    expect(existsSync(refPointerPath(refsDir, 'production'))).toBe(true);
  });

  it('maps an invalid ref name to the MigrationToolsError envelope without writing', async () => {
    const result = await advanceRefSafely({
      refsDir,
      migrationsDir,
      name: '',
      hash: HASH_A,
      contractIR: sampleContractIR(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.toEnvelope()).toEqual(errorInvalidRefName('').toEnvelope());
    }
    expect(existsSync(contractSnapshotDir(migrationsDir, HASH_A))).toBe(false);
  });
});
