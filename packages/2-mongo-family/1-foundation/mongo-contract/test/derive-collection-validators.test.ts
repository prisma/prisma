import type {
  ContractEmbedRelation,
  ContractField,
  ContractModelBase,
} from '@internal/contract/types';
import { crossRef } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import {
  type CollectionValidatorsInput,
  deriveCollectionValidators,
} from '../src/derive-collection-validators';
import { enumField, mongoTypeLookups, scalarField, voField } from './derive-json-schema-helpers';

type Model = CollectionValidatorsInput['models'][string];

function model(
  fields: Record<string, ContractField>,
  extra: Partial<Pick<ContractModelBase, 'relations' | 'discriminator' | 'variants'>> = {},
): Model {
  return { fields, relations: {}, ...extra };
}

function embedOne(to: string): ContractEmbedRelation {
  return { to: crossRef(to), cardinality: '1:1' };
}

function embedMany(to: string): ContractEmbedRelation {
  return { to: crossRef(to), cardinality: '1:N' };
}

const addressSchema = {
  bsonType: 'object',
  required: ['city'],
  properties: { city: { bsonType: 'string' } },
  additionalProperties: false,
};

function derive(
  input: Pick<CollectionValidatorsInput, 'roots' | 'models'> &
    Partial<Pick<CollectionValidatorsInput, 'valueObjects' | 'valueSets'>>,
) {
  return deriveCollectionValidators({
    lookups: mongoTypeLookups,
    valueObjects: {},
    valueSets: {},
    ...input,
  });
}

function jsonSchemas(validators: ReturnType<typeof deriveCollectionValidators>) {
  return Object.fromEntries(Object.entries(validators).map(([name, v]) => [name, v.jsonSchema]));
}

const objectId = () => scalarField('mongo/objectId@1');

describe('deriveCollectionValidators', () => {
  it('derives a closed validator for the root model of each collection', () => {
    const validators = derive({
      roots: { users: crossRef('User'), posts: crossRef('Post') },
      models: {
        User: model({ _id: objectId(), email: scalarField('mongo/string@1') }),
        Post: model({ _id: objectId() }),
      },
    });

    expect(jsonSchemas(validators)).toEqual({
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

  it('derives validators for root models only', () => {
    const validators = derive({
      roots: { users: crossRef('User') },
      models: {
        User: model({ _id: objectId() }),
        Address: model({ city: scalarField('mongo/string@1') }),
      },
    });

    expect(Object.keys(validators)).toEqual(['users']);
  });

  it('derives one polymorphic validator for a root model and its variants', () => {
    const validators = derive({
      roots: { tasks: crossRef('Task') },
      models: {
        Task: model(
          { _id: objectId(), type: scalarField('mongo/string@1') },
          { discriminator: { field: 'type' }, variants: { bug: crossRef('Bug') } },
        ),
        Bug: model({
          _id: objectId(),
          type: scalarField('mongo/string@1'),
          severity: scalarField('mongo/int32@1'),
        }),
      },
    });

    expect(jsonSchemas(validators)).toEqual({
      tasks: {
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
      },
    });
  });

  it('refuses a root whose model is missing', () => {
    expect(() => derive({ roots: { users: crossRef('User') }, models: {} })).toThrow(
      'Root model "User" of collection "users" is missing',
    );
  });

  it('refuses a variant whose model is missing', () => {
    expect(() =>
      derive({
        roots: { tasks: crossRef('Task') },
        models: {
          Task: model(
            { _id: objectId(), type: scalarField('mongo/string@1') },
            { discriminator: { field: 'type' }, variants: { bug: crossRef('Bug') } },
          ),
        },
      }),
    ).toThrow('Variant model "Bug" of "Task" is missing');
  });

  it('describes value object fields as nested closed objects', () => {
    const validators = derive({
      roots: { users: crossRef('User') },
      models: { User: model({ _id: objectId(), address: voField('Address') }) },
      valueObjects: { Address: { fields: { city: scalarField('mongo/string@1') } } },
    });

    expect(jsonSchemas(validators)).toEqual({
      users: {
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
      },
    });
  });

  describe('embedded models', () => {
    const Address = model({ city: scalarField('mongo/string@1') });

    it('describes an embedded model as a nested closed object the document may omit', () => {
      const validators = derive({
        roots: { owners: crossRef('Owner') },
        models: {
          Owner: model({ _id: objectId() }, { relations: { home: embedOne('Address') } }),
          Address,
        },
      });

      expect(jsonSchemas(validators)).toEqual({
        owners: {
          bsonType: 'object',
          required: ['_id'],
          properties: { _id: { bsonType: 'objectId' }, home: addressSchema },
          additionalProperties: false,
        },
      });
    });

    it('describes a list of embedded models as an array of nested closed objects', () => {
      const validators = derive({
        roots: { owners: crossRef('Owner') },
        models: {
          Owner: model({ _id: objectId() }, { relations: { addresses: embedMany('Address') } }),
          Address,
        },
      });

      expect(jsonSchemas(validators)).toEqual({
        owners: {
          bsonType: 'object',
          required: ['_id'],
          properties: {
            _id: { bsonType: 'objectId' },
            addresses: { bsonType: 'array', items: addressSchema },
          },
          additionalProperties: false,
        },
      });
    });

    it('describes models embedded in an embedded model', () => {
      const validators = derive({
        roots: { owners: crossRef('Owner') },
        models: {
          Owner: model({ _id: objectId() }, { relations: { home: embedOne('Home') } }),
          Home: model({}, { relations: { address: embedOne('Address') } }),
          Address,
        },
      });

      expect(jsonSchemas(validators)['owners']).toMatchObject({
        properties: {
          home: {
            bsonType: 'object',
            properties: { address: addressSchema },
            additionalProperties: false,
          },
        },
      });
    });

    it('leaves reference relations out, since they are not stored in the document', () => {
      const validators = derive({
        roots: { owners: crossRef('Owner') },
        models: {
          Owner: model(
            { _id: objectId() },
            {
              relations: {
                posts: {
                  to: crossRef('Post'),
                  cardinality: '1:N',
                  on: { localFields: ['_id'], targetFields: ['ownerId'] },
                },
              },
            },
          ),
        },
      });

      expect(jsonSchemas(validators)['owners']).toEqual({
        bsonType: 'object',
        required: ['_id'],
        properties: { _id: { bsonType: 'objectId' } },
        additionalProperties: false,
      });
    });

    it('adds the embedded models of a variant to its branch', () => {
      const validators = derive({
        roots: { tasks: crossRef('Task') },
        models: {
          Task: model(
            { _id: objectId(), type: scalarField('mongo/string@1') },
            { discriminator: { field: 'type' }, variants: { visit: crossRef('Visit') } },
          ),
          Visit: model(
            { _id: objectId(), type: scalarField('mongo/string@1') },
            { relations: { place: embedOne('Address') } },
          ),
          Address,
        },
      });

      expect(jsonSchemas(validators)['tasks']).toMatchObject({
        oneOf: [
          {
            properties: {
              _id: { bsonType: 'objectId' },
              type: { enum: ['visit'] },
              place: addressSchema,
            },
            required: ['type'],
            additionalProperties: false,
          },
        ],
      });
    });

    it('refuses an embedded model that is missing', () => {
      expect(() =>
        derive({
          roots: { owners: crossRef('Owner') },
          models: {
            Owner: model({ _id: objectId() }, { relations: { home: embedOne('Address') } }),
          },
        }),
      ).toThrow('Embedded model "Address" is missing');
    });
  });

  it('lists the stored values of an enum field', () => {
    const validators = derive({
      roots: { users: crossRef('User') },
      models: { User: model({ _id: objectId(), role: enumField('mongo/string@1', 'Role') }) },
      valueSets: { Role: { values: ['user', 'admin'] } },
    });

    expect(jsonSchemas(validators)).toEqual({
      users: {
        bsonType: 'object',
        required: ['_id', 'role'],
        properties: {
          _id: { bsonType: 'objectId' },
          role: { bsonType: 'string', enum: ['user', 'admin'] },
        },
        additionalProperties: false,
      },
    });
  });
});
