import { dataType } from '@internal/framework-components/codec';
import type { ExtensionPackRef } from '@internal/framework-components/components';
import { describe, expect, it } from 'vitest';
import { defineContract, field, model, rel, valueObject } from '../src/contract-builder';
import { enumType, member } from '../src/enum-type';
import { identityCodecDescriptor, mongoFamilyPack, mongoTargetPack } from './mongo-test-packs';

const scaffold = { family: mongoFamilyPack, target: mongoTargetPack } as const;

const sqlTypedPack = {
  kind: 'extension',
  id: 'geo',
  familyId: 'mongo',
  targetId: 'mongo',
  version: '0.0.1',
  dataTypes: [dataType('geo/point', {})],
  types: {
    codecTypes: { codecDescriptors: [identityCodecDescriptor('geo/point@1', 'geo/point')] },
  },
} as const satisfies ExtensionPackRef<'mongo', 'mongo'>;

const holdsId = (description: string) =>
  `holds the document id as ${description}, but an _id must be stored as BSON type objectId: every collection validator requires an objectId _id, which MongoDB adds to every document inserted without one.`;

describe('mongo defineContract refuses what a collection validator cannot describe', () => {
  describe('a codec with no MongoDB data type', () => {
    it('refuses a model field whose codec no pack provides', () => {
      const Place = model('Place', {
        collection: 'places',
        fields: { _id: field.objectId(), location: field.scalar('geo/point@1') },
      });
      expect(() => defineContract({ ...scaffold, models: { Place } })).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.CODEC_DESCRIPTOR_MISSING',
          message:
            'Model "Place" field "location" uses codec "geo/point@1", which no pack in the contract provides, so the collection validator cannot give its BSON type.',
          meta: { modelName: 'Place', fieldName: 'location', codecId: 'geo/point@1' },
        }),
      );
    });

    it('refuses a field whose codec represents a data type that is not a MongoDB data type', () => {
      const Place = model('Place', {
        collection: 'places',
        fields: { _id: field.objectId(), location: field.scalar('geo/point@1') },
      });
      expect(() =>
        defineContract({ ...scaffold, extensions: { geo: sqlTypedPack }, models: { Place } }),
      ).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.PACK_CONTRIBUTION_INVALID',
          message:
            'Model "Place" field "location" uses codec "geo/point@1", whose data type "geo/point" is not a MongoDB data type of any pack in the contract, so the collection validator cannot give its BSON type.',
          meta: {
            modelName: 'Place',
            fieldName: 'location',
            codecId: 'geo/point@1',
            dataType: 'geo/point',
            reason: 'data-type-not-mongo',
          },
        }),
      );
    });

    it('refuses a value object field whose codec no pack provides', () => {
      const Address = valueObject('Address', { fields: { zip: field.scalar('geo/zip@1') } });
      const User = model('User', {
        collection: 'users',
        fields: { _id: field.objectId(), address: field.valueObject(Address) },
      });
      expect(() =>
        defineContract({ ...scaffold, models: { User }, valueObjects: { Address } }),
      ).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.CODEC_DESCRIPTOR_MISSING',
          message:
            'Value object "Address" field "zip" uses codec "geo/zip@1", which no pack in the contract provides, so the collection validator cannot give its BSON type.',
        }),
      );
    });

    it('names the codec of an _id that no pack provides, not the missing _id', () => {
      const User = model('User', {
        collection: 'users',
        fields: { _id: field.scalar('custom/uuid@1') },
      });
      expect(() => defineContract({ ...scaffold, models: { User } })).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.CODEC_DESCRIPTOR_MISSING',
          message:
            'Model "User" field "_id" uses codec "custom/uuid@1", which no pack in the contract provides, so the collection validator cannot give its BSON type.',
        }),
      );
    });
  });

  describe('the document id', () => {
    it('accepts a root model without an _id field', () => {
      const User = model('User', { collection: 'users', fields: { email: field.string() } });
      expect(() => defineContract({ ...scaffold, models: { User } })).not.toThrow();
    });

    it.each([
      ['a string', field.string(), 'BSON type string'],
      ['a date', field.date(), 'BSON type date'],
      ['bytes', field.binary(), 'BSON type binData'],
      ['a BSON document', field.bson(), 'any BSON type'],
      ['an int', field.int32(), 'BSON type int'],
    ])('refuses a root model whose _id holds %s', (_case, idField, description) => {
      const User = model('User', { collection: 'users', fields: { _id: idField } });
      expect(() => defineContract({ ...scaffold, models: { User } })).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.COLLECTION_INVALID',
          message: `Model "User" field "_id" ${holdsId(description)}`,
          meta: { modelName: 'User', collection: 'users', reason: 'document-id-not-objectId' },
        }),
      );
    });

    it.each([
      ['listed first', true],
      ['listed last', false],
    ])('refuses a root model with a string _id that shares its collection, %s', (_case, first) => {
      const User = model('User', { collection: 'users', fields: { _id: field.string() } });
      const Admin = model('Admin', { collection: 'users', fields: { _id: field.objectId() } });
      const models = first ? { User, Admin } : { Admin, User };
      expect(() => defineContract({ ...scaffold, models })).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.COLLECTION_INVALID',
          message: `Model "User" field "_id" ${holdsId('BSON type string')}`,
        }),
      );
    });

    it('accepts an embedded model and a variant without an _id', () => {
      const Task = model('Task', {
        collection: 'tasks',
        fields: { _id: field.objectId(), type: field.string() },
        relations: { notes: rel.hasMany('Note') },
        discriminator: { field: 'type', variants: { Bug: { value: 'bug' } } },
      });
      const Bug = model('Bug', {
        collection: 'tasks',
        base: Task,
        fields: { level: field.int32() },
      });
      const Note = model('Note', { owner: Task, fields: { text: field.string() } });
      expect(() => defineContract({ ...scaffold, models: { Task, Bug, Note } })).not.toThrow();
    });
  });

  describe('enums', () => {
    it('refuses an enum whose codec stores a BSON type a validator cannot list', () => {
      const Big = enumType('Big', { codecId: 'mongo/int64@1' }, member('One', 1));
      expect(() => defineContract({ ...scaffold, enums: { Big }, models: {} })).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.ENUM_INVALID',
          message:
            'enumType("Big") codec "mongo/int64@1" stores BSON type long, which a collection validator cannot list as an enum value. Use a codec whose BSON type is string, int, double, bool, object or array.',
          meta: { enumName: 'Big', codecId: 'mongo/int64@1', reason: 'not-listable-by-validator' },
        }),
      );
    });

    it('refuses an enum member a validator cannot list', () => {
      const Ratio = enumType(
        'Ratio',
        { codecId: 'mongo/double@1' },
        member('Half', 0.5),
        member('All', '1'),
      );
      expect(() => defineContract({ ...scaffold, enums: { Ratio }, models: {} })).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.ENUM_INVALID',
          message:
            'enumType("Ratio") member "All" is stored as "1", which a collection validator cannot list as a double. A member of a double enum must be a finite number.',
          meta: {
            enumName: 'Ratio',
            member: 'All',
            codecId: 'mongo/double@1',
            reason: 'member-not-listable-by-validator',
          },
        }),
      );
    });
  });

  it('refuses an embed relation to a model with variants', () => {
    const Owner = model('Owner', {
      collection: 'owners',
      fields: { _id: field.objectId() },
      relations: { task: rel.hasOne('Task') },
    });
    const Task = model('Task', {
      owner: Owner,
      fields: { type: field.string() },
      discriminator: { field: 'type', variants: { Bug: { value: 'bug' } } },
    });
    const Bug = model('Bug', { base: Task, fields: { severity: field.int32() } });
    expect(() => defineContract({ ...scaffold, models: { Owner, Task, Bug } })).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.RELATION_INVALID',
        message:
          'Relation "Owner.task" embeds model "Task", which has variants. The ORM reads and writes only the base fields of an embedded model, so an embedded model cannot have variants.',
        meta: { modelName: 'Owner', relationName: 'task', reason: 'embedded-model-has-variants' },
      }),
    );
  });
});
