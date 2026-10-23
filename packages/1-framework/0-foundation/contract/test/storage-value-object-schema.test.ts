import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { StorageValueObjectSchema } from '../src/storage-value-object-schema';

const text = { type: { kind: 'scalar', codecId: 'pg/text@1' }, nullable: false };
const addressReference = {
  kind: 'valueObject',
  plane: 'storage',
  namespaceId: 'public',
  entityKind: 'valueObject',
  entityName: 'Address',
};

describe('StorageValueObjectSchema', () => {
  it('accepts scalar, value object and union members, lists, dictionaries and value sets', () => {
    const valueObject = {
      fields: {
        street: text,
        home: { type: addressReference, nullable: true, many: { elementNullable: false } },
        either: {
          type: { kind: 'union', members: [text.type, addressReference] },
          nullable: false,
        },
        tags: { ...text, dict: true },
        kind: {
          ...text,
          valueSet: {
            plane: 'storage',
            namespaceId: 'public',
            entityKind: 'valueSet',
            entityName: 'Kind',
          },
        },
      },
    };
    expect(StorageValueObjectSchema(valueObject)).toEqual(valueObject);
  });

  it.each([
    ['a member without nullable', { street: { type: text.type } }],
    ['a member with dict false', { street: { ...text, dict: false } }],
    ['a member with an unknown key', { street: { ...text, column: 'street' } }],
    [
      'a member that names its value object the old way',
      { home: { ...text, type: { kind: 'valueObject', name: 'Address' } } },
    ],
    [
      'a member value set in the domain plane',
      {
        kind: {
          ...text,
          valueSet: {
            plane: 'domain',
            namespaceId: 'public',
            entityKind: 'enum',
            entityName: 'Kind',
          },
        },
      },
    ],
  ])('refuses %s', (_case, fields) => {
    expect(StorageValueObjectSchema({ fields })).toBeInstanceOf(type.errors);
  });
});
