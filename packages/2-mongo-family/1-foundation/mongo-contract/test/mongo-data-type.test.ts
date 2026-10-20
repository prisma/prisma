import type { JsonValue } from '@internal/contract/types';
import { type DataType, dataType, type TypeLookups } from '@internal/framework-components/codec';
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { assertMongoFieldTypeParams, isMongoDataType, mongoDataType } from '../src/mongo-data-type';

const valueMethods = {
  fromContract: expect.any(Function),
  toContract: expect.any(Function),
  valueFrom: expect.any(Function),
};

describe('mongoDataType', () => {
  it('declares a data type with the BSON types it is stored as', () => {
    const declared = mongoDataType('demo/number', {
      read: (json) => json,
      bsonTypes: ['int', 'long'],
    });
    expect(declared).toEqual({
      id: 'demo/number',
      casts: {},
      mongo: { bsonTypes: ['int', 'long'] },
      ...valueMethods,
    });
  });

  it('allows a type stored as no one BSON type', () => {
    expect(
      mongoDataType('demo/any', { read: (json) => json, bsonTypes: [] }).mongo.bsonTypes,
    ).toEqual([]);
  });

  it('keeps the parameter schema and the casts', () => {
    const params = type({ 'length?': 'number.integer >= 1' });
    const text = mongoDataType('demo/text', { read: (json) => json, bsonTypes: ['string'] });
    const declared = mongoDataType('demo/vector', {
      read: (json) => json,
      bsonTypes: ['array'],
      params,
      casts: { [text.id]: (value) => value },
    });
    expect(declared.params).toBe(params);
    expect(declared.casts[text.id]?.('x')).toBe('x');
  });

  it('keeps every field of the framework declaration', () => {
    const text = mongoDataType('demo/text', { read: (json) => json, bsonTypes: ['string'] });
    const casts = { [text.id]: (value: JsonValue) => value };
    const declared = mongoDataType('demo/kept', {
      read: (json) => json,
      bsonTypes: ['string'],
      casts,
    });
    const { mongo: _mongo, ...frameworkFields } = declared;
    expect(frameworkFields).toEqual({
      ...dataType('demo/kept', { read: (json) => json, casts }),
      ...valueMethods,
    });
  });

  it('validates its id like every data type', () => {
    expect(() => mongoDataType('demo/number@1', { read: (json) => json, bsonTypes: [] })).toThrow(
      /is not a data type id/,
    );
  });
});

describe('isMongoDataType', () => {
  it('recognises a Mongo data type', () => {
    expect(
      isMongoDataType(mongoDataType('demo/number', { read: (json) => json, bsonTypes: ['int'] })),
    ).toBe(true);
  });

  it('does not claim a plain data type', () => {
    expect(isMongoDataType(dataType('demo/plain', { read: (json) => json }))).toBe(false);
  });

  it('does not claim a data type of another family', () => {
    expect(
      isMongoDataType({ ...dataType('demo/sql', { read: (json) => json }), sql: {} } as DataType),
    ).toBe(false);
  });
});

describe('assertMongoFieldTypeParams', () => {
  const vector = mongoDataType('demo/vector', {
    bsonTypes: ['array'],
    params: type({ 'length?': 'number.integer >= 1' }),
    read: (json) => json,
  });
  const lookups = {
    codecLookup: {
      descriptorFor: (codecId: string) =>
        codecId === 'demo/vector@1' ? { dataType: vector.id } : undefined,
    },
    dataTypeLookup: { get: (id: string) => (id === vector.id ? vector : undefined) },
  } as unknown as TypeLookups;
  const vectorField = (length: number) => ({
    nullable: false,
    type: { kind: 'scalar' as const, codecId: 'demo/vector@1', typeParams: { length } },
  });

  it('accepts type parameters the data type allows, and fields without any', () => {
    expect(() =>
      assertMongoFieldTypeParams(
        {
          app: {
            models: {
              Doc: {
                fields: {
                  embedding: vectorField(3),
                  name: { nullable: false, type: { kind: 'scalar', codecId: 'demo/text@1' } },
                },
              },
            },
          },
        },
        lookups,
      ),
    ).not.toThrow();
  });

  it.each([0, -1, 2.5])('refuses a model field whose length is %s', (length) => {
    expect(() =>
      assertMongoFieldTypeParams(
        { app: { models: { Doc: { fields: { embedding: vectorField(length) } } } } },
        lookups,
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.TYPE_PARAMS_INVALID',
        meta: expect.objectContaining({
          dataType: 'demo/vector',
          parameters: ['length'],
          modelName: 'Doc',
          fieldName: 'embedding',
        }),
      }),
    );
  });

  it('refuses a value object field the same way', () => {
    expect(() =>
      assertMongoFieldTypeParams(
        {
          app: {
            models: {},
            valueObjects: { Embedding: { fields: { values: vectorField(0) } } },
          },
        },
        lookups,
      ),
    ).toThrow(
      expect.objectContaining({
        meta: expect.objectContaining({ valueObjectName: 'Embedding', fieldName: 'values' }),
      }),
    );
  });
});
