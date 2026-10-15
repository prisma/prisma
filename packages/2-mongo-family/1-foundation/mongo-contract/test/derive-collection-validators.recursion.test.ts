import { crossRef } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import {
  derive,
  embedMany,
  embedOne,
  jsonSchemas,
  model,
  objectId,
} from './collection-validator-helpers';
import { scalarField, voArrayField, voField } from './derive-json-schema-helpers';

const label = () => scalarField('mongo/string@1');
const openObject = { bsonType: 'object' };

describe('deriveCollectionValidators for types that contain themselves', () => {
  describe('value objects', () => {
    it('describes a list of a value object inside itself as a list of open objects', () => {
      const validators = derive({
        roots: { menus: crossRef('Menu') },
        models: { Menu: model({ _id: objectId(), items: voArrayField('NavItem') }) },
        valueObjects: {
          NavItem: { fields: { label: label(), children: voArrayField('NavItem') } },
        },
      });

      expect(jsonSchemas(validators)['menus']).toEqual({
        bsonType: 'object',
        required: ['_id', 'items'],
        properties: {
          _id: { bsonType: 'objectId' },
          items: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['children', 'label'],
              properties: {
                label: { bsonType: 'string' },
                children: { bsonType: 'array', items: openObject },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      });
    });

    it('describes an optional value object inside itself as an open object or null', () => {
      const validators = derive({
        roots: { lists: crossRef('List') },
        models: { List: model({ _id: objectId(), head: voField('Node') }) },
        valueObjects: { Node: { fields: { label: label(), next: voField('Node', true) } } },
      });

      expect(jsonSchemas(validators)['lists']).toMatchObject({
        properties: {
          head: {
            bsonType: 'object',
            required: ['label'],
            properties: {
              label: { bsonType: 'string' },
              next: { oneOf: [{ bsonType: 'null' }, openObject] },
            },
            additionalProperties: false,
          },
        },
      });
    });

    it('keeps the nullable forms of a list at the repeat', () => {
      const validators = derive({
        roots: { trees: crossRef('Tree') },
        models: { Tree: model({ _id: objectId(), root: voField('Node') }) },
        valueObjects: { Node: { fields: { children: voArrayField('Node', true, true) } } },
      });

      expect(jsonSchemas(validators)['trees']).toMatchObject({
        properties: {
          root: {
            properties: {
              children: {
                bsonType: ['null', 'array'],
                items: { oneOf: [{ bsonType: 'null' }, openObject] },
              },
            },
          },
        },
      });
    });

    it('describes a value object reached again through another value object as an open object', () => {
      const validators = derive({
        roots: { things: crossRef('Thing') },
        models: { Thing: model({ _id: objectId(), a: voField('A') }) },
        valueObjects: {
          A: { fields: { label: label(), b: voField('B') } },
          B: { fields: { as: voArrayField('A') } },
        },
      });

      expect(jsonSchemas(validators)['things']).toMatchObject({
        properties: {
          a: {
            properties: {
              label: { bsonType: 'string' },
              b: {
                bsonType: 'object',
                required: ['as'],
                properties: { as: { bsonType: 'array', items: openObject } },
                additionalProperties: false,
              },
            },
            additionalProperties: false,
          },
        },
      });
    });

    it('describes the same value object in full beside itself, since it is not inside itself', () => {
      const address = { fields: { city: scalarField('mongo/string@1') } };
      const validators = derive({
        roots: { users: crossRef('User') },
        models: {
          User: model({ _id: objectId(), home: voField('Address'), work: voField('Address') }),
        },
        valueObjects: { Address: address },
      });

      const described = {
        bsonType: 'object',
        required: ['city'],
        properties: { city: { bsonType: 'string' } },
        additionalProperties: false,
      };
      expect(jsonSchemas(validators)['users']).toMatchObject({
        properties: { home: described, work: described },
      });
    });
  });

  describe('embedded models', () => {
    it('describes a list of a model embedded in itself as a list of open objects', () => {
      const validators = derive({
        roots: { roots: crossRef('Root') },
        models: {
          Root: model({ _id: objectId() }, { relations: { nodes: embedMany('Node') } }),
          Node: model({ label: label() }, { relations: { children: embedMany('Node') } }),
        },
      });

      expect(jsonSchemas(validators)['roots']).toEqual({
        bsonType: 'object',
        required: ['_id'],
        properties: {
          _id: { bsonType: 'objectId' },
          nodes: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['label'],
              properties: {
                label: { bsonType: 'string' },
                children: { bsonType: 'array', items: openObject },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      });
    });

    it('describes a model reached again through another embedded model as an open object', () => {
      const validators = derive({
        roots: { roots: crossRef('Root') },
        models: {
          Root: model({ _id: objectId() }, { relations: { a: embedOne('A') } }),
          A: model({}, { relations: { b: embedOne('B') } }),
          B: model({}, { relations: { a: embedOne('A') } }),
        },
      });

      expect(jsonSchemas(validators)['roots']).toMatchObject({
        properties: {
          a: { properties: { b: { properties: { a: openObject }, additionalProperties: false } } },
        },
      });
    });
  });
});
