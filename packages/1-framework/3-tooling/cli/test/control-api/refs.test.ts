import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { MigrationToolsError } from '@internal/migration-tools/errors';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readMigrationRefs } from '../../src/control-api/operations/refs';

const mocks = vi.hoisted(() => ({
  readRefs: vi.fn(),
}));

vi.mock('@internal/migration-tools/refs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@internal/migration-tools/refs')>();
  return { ...actual, readRefs: mocks.readRefs };
});

const HASH_A = `${'a'.repeat(64)}`;

describe('readMigrationRefs', () => {
  let refsDir: string;

  beforeEach(async () => {
    const { readRefs: actualReadRefs } = await vi.importActual<
      typeof import('@internal/migration-tools/refs')
    >('@internal/migration-tools/refs');
    mocks.readRefs.mockReset();
    mocks.readRefs.mockImplementation(actualReadRefs);
    refsDir = join(
      tmpdir(),
      `test-read-migration-refs-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
  });

  afterEach(async () => {
    await rm(refsDir, { recursive: true, force: true });
  });

  it('returns ok with an empty index when the refs directory is absent', async () => {
    const result = await readMigrationRefs(refsDir);
    expect(result).toEqual({ ok: true, value: {} });
  });

  it('returns ok with the parsed entries for a populated refs directory', async () => {
    await mkdir(refsDir, { recursive: true });
    await writeFile(
      join(refsDir, 'staging.json'),
      JSON.stringify({ hash: HASH_A, invariants: [] }),
    );
    const result = await readMigrationRefs(refsDir);
    expect(result).toEqual({
      ok: true,
      value: { staging: { hash: HASH_A, invariants: [] } },
    });
  });

  it('passes a corrupt-ref-file MigrationToolsError through unchanged', async () => {
    await mkdir(refsDir, { recursive: true });
    await writeFile(join(refsDir, 'staging.json'), '{not json');

    const { readRefs: actualReadRefs } = await vi.importActual<
      typeof import('@internal/migration-tools/refs')
    >('@internal/migration-tools/refs');
    let thrown: unknown;
    try {
      await actualReadRefs(refsDir);
    } catch (error) {
      thrown = error;
    }
    expect(MigrationToolsError.is(thrown)).toBe(true);

    const result = await readMigrationRefs(refsDir);
    expect(result.ok).toBe(false);
    if (!result.ok && MigrationToolsError.is(thrown)) {
      expect(result.failure.toEnvelope()).toEqual(thrown.toEnvelope());
    }
  });

  it('rethrows non-MigrationToolsError failures', async () => {
    mocks.readRefs.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await expect(readMigrationRefs(refsDir)).rejects.toThrow('boom');
  });
});
