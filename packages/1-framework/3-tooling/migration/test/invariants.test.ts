import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { ifDefined } from '@internal/utils/defined';
import { describe, expect, it } from 'vitest';
import { MigrationToolsError } from '../src/errors';
import { deriveProvidedInvariants, validateInvariantId } from '../src/invariants';

function dataOp(name: string, invariantId?: string): MigrationPlanOperation {
  return {
    id: `data_migration.${name}`,
    label: `Data transform: ${name}`,
    operationClass: 'data',
    ...ifDefined('invariantId', invariantId),
  };
}

function nonDataOp(id: string): MigrationPlanOperation {
  return { id, label: id, operationClass: 'additive' };
}

describe('validateInvariantId', () => {
  it.each([
    'a',
    'backfill-user-phone',
    'users/backfill-phone',
    'env/staging/clean-emails',
    'BackfillUserPhone',
    'users.phone_backfill',
    'migration:042/cleanup',
    '-leading-hyphen',
    'trailing-hyphen-',
    'two..dots',
    'double//slash',
    '.dot-start',
    'naïve-cafe', // non-ASCII Unicode is the author's call
  ])('accepts valid id %s', (id) => {
    expect(validateInvariantId(id)).toBe(true);
  });

  it.each([
    '',
    ' ',
    'with space',
    'tab\there',
    'newline\nhere',
    '\r',
    '\x00null',
    '\x7Fdel',
    'with nbsp',
    'with emspace',
    'with lineSep',
  ])('rejects invalid id %s', (id) => {
    expect(validateInvariantId(id)).toBe(false);
  });
});

describe('deriveProvidedInvariants', () => {
  it('returns empty when no ops have invariantId', () => {
    expect(deriveProvidedInvariants([nonDataOp('add-table'), dataOp('cleanup')])).toEqual([]);
  });

  it('includes invariantIds from additive ops alongside data ops', () => {
    // Both data-class and additive-class ops may declare invariantIds for
    // marker bookkeeping. operationClass governs policy gating; invariantId
    // governs replay tracking. Cipherstash's `installEqlBundle` and
    // structural `create-*` ops are the canonical additive-with-invariantId
    // case (sub-spec § 3 / cipherstash-migration.spec.md).
    expect(
      deriveProvidedInvariants([
        nonDataOp('add-table'),
        { ...nonDataOp('install-bundle'), invariantId: 'ext:bundle-v1' } as MigrationPlanOperation,
        dataOp('phone-backfill', 'phone-backfill'),
      ]),
    ).toEqual(['ext:bundle-v1', 'phone-backfill']);
  });

  it('returns sorted, deduplicated invariantIds across all ops', () => {
    expect(
      deriveProvidedInvariants([dataOp('z', 'zebra'), dataOp('a', 'apple'), dataOp('m', 'mango')]),
    ).toEqual(['apple', 'mango', 'zebra']);
  });

  it('throws INVALID_INVARIANT_ID on a malformed id', () => {
    expect(() => deriveProvidedInvariants([dataOp('with space', 'has a space')])).toThrowError(
      expect.objectContaining({
        code: 'MIGRATION.INVALID_INVARIANT_ID',
        meta: { invariantId: 'has a space' },
      }) as unknown as Error,
    );
  });

  it('throws DUPLICATE_INVARIANT_IN_EDGE when two data ops share an invariantId', () => {
    let caught: unknown;
    try {
      deriveProvidedInvariants([
        dataOp('first-cleanup', 'shared'),
        dataOp('second-cleanup', 'shared'),
      ]);
    } catch (e) {
      caught = e;
    }
    expect(MigrationToolsError.is(caught)).toBe(true);
    if (MigrationToolsError.is(caught)) {
      expect(caught.code).toBe('MIGRATION.DUPLICATE_INVARIANT_IN_EDGE');
      expect(caught.meta).toEqual({ invariantId: 'shared' });
    }
  });
});
