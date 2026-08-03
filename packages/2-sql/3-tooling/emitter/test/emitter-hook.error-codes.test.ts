import { isStructuredError } from '@internal/utils/structured-error';
import { describe, expect, it } from 'vitest';
import { sqlEmission } from '../src/index';
import { createEmitterTestContract as createContract } from './create-emitter-test-contract';

function captureError(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to throw');
}

const emptyTable = {
  columns: {},
  uniques: [],
  indexes: [],
  foreignKeys: [],
};

describe('sql emitter structured error codes', () => {
  it('raises CONTRACT.VALIDATION_FAILED when a model references a non-existent table', () => {
    const ir = createContract({
      models: {
        User: {
          fields: {},
          storage: { namespaceId: '__unbound__', table: 'nonexistent', fields: {} },
          relations: {},
        },
      },
      storage: { tables: { user: emptyTable } },
    });

    const error = captureError(() => sqlEmission.validateStructure(ir));
    expect(isStructuredError(error)).toBe(true);
    expect(error).toMatchObject({
      code: 'CONTRACT.VALIDATION_FAILED',
      message: expect.stringContaining('references non-existent table'),
    });
  });

  it('raises CONTRACT.NAME_DUPLICATE for the same table name in two namespaces', () => {
    const ir = createContract({
      storage: {
        namespaces: {
          ns_one: { tables: { user: emptyTable } },
          ns_two: { tables: { user: emptyTable } },
        },
      },
    });

    const error = captureError(() => sqlEmission.validateStructure(ir));
    expect(isStructuredError(error)).toBe(true);
    expect(error).toMatchObject({
      code: 'CONTRACT.NAME_DUPLICATE',
      message: 'Duplicate table name "user" in namespaces "ns_one" and "ns_two"',
      meta: { table: 'user', namespaces: ['ns_one', 'ns_two'] },
    });
  });

  it('raises CONTRACT.TYPE_UNKNOWN for a storage.types entry that is not a codec-instance triple', () => {
    const ir = createContract({
      storage: { tables: {}, types: { weird: { notACodec: true } } },
    });

    const error = captureError(() => sqlEmission.generateStorageType(ir, 'StorageHash'));
    expect(isStructuredError(error)).toBe(true);
    expect(error).toMatchObject({
      code: 'CONTRACT.TYPE_UNKNOWN',
      meta: { type: 'weird' },
    });
  });

  it('raises CONTRACT.NAMESPACE_INVALID for a namespace without a string kind', () => {
    const ir = createContract({
      storage: { namespaces: { bad: { id: 'bad' } } },
    });

    const error = captureError(() => sqlEmission.generateStorageType(ir, 'StorageHash'));
    expect(isStructuredError(error)).toBe(true);
    expect(error).toMatchObject({
      code: 'CONTRACT.NAMESPACE_INVALID',
      meta: { namespace: 'bad' },
    });
  });
});
