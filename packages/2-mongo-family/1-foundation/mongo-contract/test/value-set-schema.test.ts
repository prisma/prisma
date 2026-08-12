import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { createMongoNamespaceEnvelopeSchema, StorageValueSetSchema } from '../src/contract-schema';

describe('StorageValueSetSchema', () => {
  it("accepts a value-set with kind 'valueSet' and string values", () => {
    const result = StorageValueSetSchema({ kind: 'valueSet', values: ['admin', 'reader'] });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('accepts numeric and boolean encoded values', () => {
    expect(StorageValueSetSchema({ kind: 'valueSet', values: [0, 1, 2] })).not.toBeInstanceOf(
      type.errors,
    );
    expect(StorageValueSetSchema({ kind: 'valueSet', values: [true, false] })).not.toBeInstanceOf(
      type.errors,
    );
  });

  it('rejects a value-set missing its values array', () => {
    expect(StorageValueSetSchema({ kind: 'valueSet' })).toBeInstanceOf(type.errors);
  });

  it('rejects a value-set with the wrong kind', () => {
    expect(StorageValueSetSchema({ kind: 'value-set', values: ['a'] })).toBeInstanceOf(type.errors);
  });
});

describe('namespace envelope with entries.valueSet', () => {
  const envelope = createMongoNamespaceEnvelopeSchema();

  it('accepts a namespace carrying a valueSet slot alongside collection', () => {
    const result = envelope({
      id: '__unbound__',
      entries: {
        collection: { accounts: { kind: 'mongo-collection' } },
        valueSet: { Role: { kind: 'valueSet', values: ['admin', 'author', 'reader'] } },
      },
    });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('accepts a namespace with only a valueSet slot', () => {
    const result = envelope({
      id: '__unbound__',
      entries: { valueSet: { Role: { kind: 'valueSet', values: ['admin'] } } },
    });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('rejects a malformed valueSet entry (missing values)', () => {
    const result = envelope({
      id: '__unbound__',
      entries: { valueSet: { Role: { kind: 'valueSet' } } },
    });
    expect(result).toBeInstanceOf(type.errors);
  });

  it('rejects a valueSet entry with the wrong kind', () => {
    const result = envelope({
      id: '__unbound__',
      entries: { valueSet: { Role: { kind: 'collection', values: ['a'] } } },
    });
    expect(result).toBeInstanceOf(type.errors);
  });
});
