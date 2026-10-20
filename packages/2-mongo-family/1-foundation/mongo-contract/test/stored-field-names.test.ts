import { describe, expect, it } from 'vitest';
import { documentIdFieldOf, storedFieldNameOf } from '../src/stored-field-names';
import { scalarField } from './derive-json-schema-helpers';

describe('stored field names', () => {
  const model = {
    fields: { _id: scalarField('mongo/objectId@1'), email: scalarField('mongo/string@1') },
  };

  it('stores a field under its own name', () => {
    expect(storedFieldNameOf(model, 'email')).toBe('email');
  });

  it('finds the field stored as _id', () => {
    expect(documentIdFieldOf(model)).toEqual({
      name: '_id',
      field: scalarField('mongo/objectId@1'),
    });
  });

  it('finds no document id field in a model that leaves _id out', () => {
    expect(documentIdFieldOf({ fields: { email: scalarField('mongo/string@1') } })).toBeUndefined();
  });
});
