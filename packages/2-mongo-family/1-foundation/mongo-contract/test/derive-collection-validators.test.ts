import { crossRef } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import {
  type CollectionValidatorModel,
  deriveCollectionValidators,
} from '../src/derive-collection-validators';
import { enumField, mongoTypeLookups, scalarField, voField } from './derive-json-schema-helpers';

function model(
  collection: string,
  fields: CollectionValidatorModel['fields'],
  extra: Partial<CollectionValidatorModel> = {},
): CollectionValidatorModel {
  return { fields, storage: { collection }, ...extra };
}

describe('deriveCollectionValidators', () => {
  it('derives a closed validator for each plain model collection', () => {
    const validators = deriveCollectionValidators({
      models: {
        User: model('users', {
          _id: scalarField('mongo/objectId@1'),
          email: scalarField('mongo/string@1'),
        }),
        Post: model('posts', { _id: scalarField('mongo/objectId@1') }),
      },
      lookups: mongoTypeLookups,
      valueObjects: {},
      valueSets: {},
    });

    expect(
      Object.fromEntries(Object.entries(validators).map(([name, v]) => [name, v.jsonSchema])),
    ).toEqual({
      users: {
        bsonType: 'object',
        required: ['_id', 'email'],
        properties: { _id: { bsonType: 'objectId' }, email: { bsonType: 'string' } },
        additionalProperties: false,
      },
      posts: {
        bsonType: 'object',
        required: ['_id'],
        properties: { _id: { bsonType: 'objectId' } },
        additionalProperties: false,
      },
    });
  });

  it('derives one polymorphic validator for a base model and its variants, and none for the variants', () => {
    const validators = deriveCollectionValidators({
      models: {
        Task: model(
          'tasks',
          { _id: scalarField('mongo/objectId@1'), type: scalarField('mongo/string@1') },
          {
            discriminator: { field: 'type' },
            variants: { bug: crossRef('Bug') },
          },
        ),
        Bug: model(
          'tasks',
          {
            _id: scalarField('mongo/objectId@1'),
            type: scalarField('mongo/string@1'),
            severity: scalarField('mongo/int32@1'),
          },
          { base: crossRef('Task') },
        ),
      },
      lookups: mongoTypeLookups,
      valueObjects: {},
      valueSets: {},
    });

    expect(Object.keys(validators)).toEqual(['tasks']);
    expect(validators['tasks']?.jsonSchema).toEqual({
      bsonType: 'object',
      required: ['_id', 'type'],
      properties: { _id: { bsonType: 'objectId' }, type: { bsonType: 'string' } },
      oneOf: [
        {
          properties: {
            _id: { bsonType: 'objectId' },
            type: { enum: ['bug'] },
            severity: { bsonType: 'int' },
          },
          required: ['severity', 'type'],
          additionalProperties: false,
        },
      ],
    });
  });

  it('describes value object fields as nested closed objects', () => {
    const validators = deriveCollectionValidators({
      models: {
        User: model('users', { _id: scalarField('mongo/objectId@1'), address: voField('Address') }),
      },
      lookups: mongoTypeLookups,
      valueObjects: { Address: { fields: { city: scalarField('mongo/string@1') } } },
      valueSets: {},
    });

    expect(validators['users']?.jsonSchema).toEqual({
      bsonType: 'object',
      required: ['_id', 'address'],
      properties: {
        _id: { bsonType: 'objectId' },
        address: {
          bsonType: 'object',
          required: ['city'],
          properties: { city: { bsonType: 'string' } },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    });
  });

  it('lists the stored values of an enum field', () => {
    const validators = deriveCollectionValidators({
      models: {
        User: model('users', {
          _id: scalarField('mongo/objectId@1'),
          role: enumField('mongo/string@1', 'Role'),
        }),
      },
      lookups: mongoTypeLookups,
      valueObjects: {},
      valueSets: { Role: { values: ['user', 'admin'] } },
    });

    expect(validators['users']?.jsonSchema).toEqual({
      bsonType: 'object',
      required: ['_id', 'role'],
      properties: {
        _id: { bsonType: 'objectId' },
        role: { bsonType: 'string', enum: ['user', 'admin'] },
      },
      additionalProperties: false,
    });
  });
});
