import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { Contract } from '@internal/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { createSqlContract } from '@repo/test-utils';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadContractSpaceAggregate } from '../../src/aggregate/loader';
import { writeTestPackage } from '../fixtures';

const mocks = vi.hoisted(() => ({
  readContractSpaceHeadRef: vi.fn(),
}));

vi.mock('../../src/read-contract-space-head-ref', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/read-contract-space-head-ref')>();
  return { ...actual, readContractSpaceHeadRef: mocks.readContractSpaceHeadRef };
});

const APP_CONTRACT = createSqlContract({
  target: 'postgres',
  storage: {
    namespaces: {
      [UNBOUND_NAMESPACE_ID]: {
        id: UNBOUND_NAMESPACE_ID,
        entries: { table: { user: {} } },
      },
    },
  },
});

const identityDeserialize = (json: unknown): Contract => json as Contract;

describe('loadContractSpaceAggregate catastrophic ref I/O', () => {
  let migrationsDir: string;

  beforeEach(async () => {
    migrationsDir = await mkdtemp(join(tmpdir(), 'load-catastrophic-io-'));
    mocks.readContractSpaceHeadRef.mockReset();
  });

  afterEach(async () => {
    await rm(migrationsDir, { recursive: true, force: true });
  });

  it('re-throws EACCES when reading an extension head ref', async () => {
    await writeTestPackage(join(migrationsDir, 'ext', '20260101T0000_init'), {
      from: null,
      to: 'ext1',
    });

    const eacces = new Error('permission denied') as NodeJS.ErrnoException;
    eacces.code = 'EACCES';
    mocks.readContractSpaceHeadRef.mockRejectedValue(eacces);

    await expect(
      loadContractSpaceAggregate({
        migrationsDir,
        deserializeContract: identityDeserialize,
        appContract: APP_CONTRACT,
      }),
    ).rejects.toMatchObject({ code: 'EACCES' });
  });

  it('tolerates a corrupt head ref as refUnreadable', async () => {
    await writeTestPackage(join(migrationsDir, 'ext', '20260101T0000_init'), {
      from: null,
      to: 'ext1',
    });

    const { errorInvalidJson } = await import('../../src/errors');
    mocks.readContractSpaceHeadRef.mockRejectedValue(
      errorInvalidJson(join(migrationsDir, 'ext', 'refs', 'head.json'), 'Unexpected token'),
    );

    const aggregate = await loadContractSpaceAggregate({
      migrationsDir,
      deserializeContract: identityDeserialize,
      appContract: APP_CONTRACT,
    });

    const violations = aggregate.checkIntegrity();
    expect(
      violations.some(
        (v) => v.kind === 'refUnreadable' && v.spaceId === 'ext' && v.refName === 'head',
      ),
    ).toBe(true);
  });
});
