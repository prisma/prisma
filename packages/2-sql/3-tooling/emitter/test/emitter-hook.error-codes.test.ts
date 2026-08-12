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

describe('sql emitter aggregate result-type error codes', () => {
  const contributedCodecs = [
    { codecId: 'pg/text@1', traits: ['textual', 'order'] },
    { codecId: 'pg/varchar@1', traits: ['textual', 'order'] },
  ] as never;

  const minTextual = {
    operation: 'min',
    input: { kind: 'trait', trait: 'textual' },
    output: { kind: 'self' },
    nullable: true,
  } as const;

  it('raises CONTRACT.AGGREGATE_DESCRIPTOR_AMBIGUOUS for a codec two traits both claim', () => {
    const error = captureError(() =>
      sqlEmission.getFamilyTypeAliases({
        aggregateDescriptors: [
          minTextual,
          { ...minTextual, input: { kind: 'trait', trait: 'order' } },
        ],
        codecDescriptors: contributedCodecs,
      }),
    );

    expect(isStructuredError(error)).toBe(true);
    expect(error).toMatchObject({
      code: 'CONTRACT.AGGREGATE_DESCRIPTOR_AMBIGUOUS',
      meta: { operation: 'min', codecId: 'pg/text@1', traits: ['textual', 'order'] },
    });
  });

  // The descriptor union rejects this pairing outright, so only a component
  // assembled in JavaScript reaches the branch — which is exactly why the
  // emitter checks rather than trusts.
  it('raises CONTRACT.AGGREGATE_DESCRIPTOR_AMBIGUOUS for a result that reuses an input the call need not carry', () => {
    const selfOverAnyInput = {
      ...minTextual,
      operation: 'count',
      input: { kind: 'any' },
    } as unknown as Parameters<typeof sqlEmission.getFamilyTypeAliases>[0];

    const error = captureError(() =>
      sqlEmission.getFamilyTypeAliases({
        aggregateDescriptors: [selfOverAnyInput] as never,
        codecDescriptors: contributedCodecs,
      }),
    );

    expect(isStructuredError(error)).toBe(true);
    expect(error).toMatchObject({
      code: 'CONTRACT.AGGREGATE_DESCRIPTOR_AMBIGUOUS',
      meta: { operation: 'count' },
    });
  });
});
