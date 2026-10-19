import { crossRef } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import { mongoContractRefusalsOf } from '../src/contract-refusals';
import type { MongoModelDefinition, MongoModelStorage } from '../src/contract-types';
import { mongoTypeLookups } from '../src/fake-type-lookups';
import { scalarField } from './derive-json-schema-helpers';

function model(
  fields: MongoModelDefinition['fields'],
  {
    storage,
    ...extra
  }: Partial<Omit<MongoModelDefinition, 'storage'>> & {
    readonly storage?: Partial<MongoModelStorage>;
  } = {},
): MongoModelDefinition {
  const identity = Object.fromEntries(Object.keys(fields).map((name) => [name, { field: name }]));
  return { fields, relations: {}, storage: { fields: identity, ...storage }, ...extra };
}

function refusals(input: Partial<Parameters<typeof mongoContractRefusalsOf>[0]>) {
  return mongoContractRefusalsOf({
    models: {},
    valueObjects: {},
    enums: {},
    lookups: mongoTypeLookups,
    ...input,
  });
}

describe('mongoContractRefusalsOf', () => {
  it('accepts a root model without an _id', () => {
    expect(
      refusals({
        models: {
          Note: model(
            { text: scalarField('mongo/string@1') },
            { storage: { collection: 'notes' } },
          ),
        },
      }),
    ).toEqual([]);
  });

  it('refuses each root model whose _id is not an objectId, in every collection', () => {
    expect(
      refusals({
        models: {
          User: model({ _id: scalarField('mongo/string@1') }, { storage: { collection: 'users' } }),
          Admin: model(
            { _id: scalarField('mongo/objectId@1') },
            { storage: { collection: 'users' } },
          ),
          Event: model({ _id: scalarField('mongo/date@1') }, { storage: { collection: 'events' } }),
        },
      }),
    ).toEqual([
      expect.objectContaining({
        kind: 'documentId',
        modelName: 'User',
        fieldName: '_id',
        collection: 'users',
      }),
      expect.objectContaining({
        kind: 'documentId',
        modelName: 'Event',
        fieldName: '_id',
        collection: 'events',
      }),
    ]);
  });

  it('names the field stored as _id by its own name', () => {
    expect(
      refusals({
        models: {
          User: model(
            { id: scalarField('mongo/string@1') },
            { storage: { collection: 'users', fields: { id: { field: '_id' } } } },
          ),
        },
      }),
    ).toEqual([
      expect.objectContaining({
        kind: 'documentId',
        modelName: 'User',
        fieldName: 'id',
        collection: 'users',
      }),
    ]);
  });

  it('leaves an _id with an unknown codec to the field rule', () => {
    expect(
      refusals({
        models: {
          User: model({ _id: scalarField('geo/id@1') }, { storage: { collection: 'users' } }),
        },
      }),
    ).toEqual([
      {
        kind: 'fieldBsonType',
        owner: { kind: 'model', name: 'User' },
        fieldName: '_id',
        codecId: 'geo/id@1',
        refusal: {
          kind: 'unknownCodec',
          reason:
            'uses codec "geo/id@1", which no pack in the contract provides, so the collection validator cannot give its BSON type.',
        },
      },
    ]);
  });

  it('refuses a value object field whose codec has no MongoDB data type', () => {
    expect(
      refusals({ valueObjects: { Address: { fields: { zip: scalarField('geo/zip@1') } } } }),
    ).toEqual([
      expect.objectContaining({
        kind: 'fieldBsonType',
        owner: { kind: 'valueObject', name: 'Address' },
        fieldName: 'zip',
      }),
    ]);
  });

  it('refuses an enum a validator cannot list, and a member it cannot list', () => {
    expect(
      refusals({
        enums: {
          Big: { codecId: 'mongo/int64@1', members: [{ name: 'One', value: 1 }] },
          Ratio: { codecId: 'mongo/double@1', members: [{ name: 'All', value: '1' }] },
        },
      }),
    ).toEqual([
      {
        kind: 'enumNotListable',
        enumName: 'Big',
        codecId: 'mongo/int64@1',
        reason:
          'stores BSON type long, which a collection validator cannot list as an enum value. Use a codec whose BSON type is string, int, double, bool, object or array.',
      },
      {
        kind: 'enumMemberNotListable',
        enumName: 'Ratio',
        member: 'All',
        codecId: 'mongo/double@1',
        reason:
          'is stored as "1", which a collection validator cannot list as a double. A member of a double enum must be a finite number.',
      },
    ]);
  });

  it('refuses an embed relation to a model with variants', () => {
    expect(
      refusals({
        models: {
          Owner: model(
            { _id: scalarField('mongo/objectId@1') },
            {
              storage: { collection: 'owners' },
              relations: { task: { to: crossRef('Task'), cardinality: '1:1' } },
            },
          ),
          Task: model(
            { type: scalarField('mongo/string@1') },
            {
              owner: 'Owner',
              discriminator: { field: 'type' },
              variants: { bug: crossRef('Bug') },
            },
          ),
          Bug: model({}, { base: crossRef('Task') }),
        },
      }),
    ).toEqual([
      {
        kind: 'embeddedModelHasVariants',
        modelName: 'Owner',
        relationName: 'task',
        embeddedModel: 'Task',
        reason:
          'embeds model "Task", which has variants. The ORM reads and writes only the base fields of an embedded model, so an embedded model cannot have variants.',
      },
    ]);
  });
});
