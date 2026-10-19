import { asNamespaceId } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import {
  documentIdFieldOf,
  fieldOfStoredName,
  hierarchyStoredFieldNamesOf,
  storedFieldNameOf,
  storedFieldNamesOf,
  storesField,
} from '../src/stored-field-names';
import { scalarField } from './derive-json-schema-helpers';

const user = {
  fields: { id: scalarField('mongo/objectId@1'), email: scalarField('mongo/string@1') },
  storage: { collection: 'users', fields: { id: { field: '_id' }, email: { field: 'email' } } },
};

const address = { fields: { street: scalarField('mongo/string@1') } };

describe('stored field names', () => {
  it('reads the stored key of each field from the model storage', () => {
    expect(storedFieldNamesOf(user)).toEqual({ id: '_id', email: 'email' });
  });

  it('stores each field of a value object under its own name', () => {
    expect(storedFieldNamesOf(address)).toEqual({ street: 'street' });
  });

  it('gives the stored key of one field', () => {
    expect(storedFieldNameOf(user, 'id')).toBe('_id');
  });

  it('refuses a name that is not a field of the model', () => {
    expect(() => storedFieldNameOf(user, '_id')).toThrow('Model has no field "_id"');
  });

  it('finds the field stored under a stored key', () => {
    expect([fieldOfStoredName(user, '_id'), fieldOfStoredName(user, 'id')]).toEqual([
      'id',
      undefined,
    ]);
  });

  it('says whether a stored key belongs to a field', () => {
    expect([storesField(user, '_id'), storesField(user, 'id')]).toEqual([true, false]);
  });

  it('finds the field stored as _id', () => {
    expect(documentIdFieldOf(user)).toEqual({ name: 'id', field: scalarField('mongo/objectId@1') });
  });

  it('finds no document id field in a model that leaves _id out', () => {
    expect(
      documentIdFieldOf({
        fields: { email: scalarField('mongo/string@1') },
        storage: { fields: { email: { field: 'email' } } },
      }),
    ).toBeUndefined();
  });

  it('includes the fields a variant inherits from its base', () => {
    const models = {
      User: user,
      Admin: {
        fields: { level: scalarField('mongo/int32@1') },
        storage: { collection: 'users', fields: { level: { field: 'admin_level' } } },
        base: { namespace: asNamespaceId('__unbound__'), model: 'User' },
      },
    };
    expect(hierarchyStoredFieldNamesOf(models, 'Admin')).toEqual({
      id: '_id',
      email: 'email',
      level: 'admin_level',
    });
  });
});
