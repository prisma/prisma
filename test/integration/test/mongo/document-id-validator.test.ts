import { defineContract } from '@internal/mongo/contract-builder';
import mongo from '@internal/mongo/runtime';
import { timeouts } from '@repo/test-utils';
import { ObjectId } from 'mongodb';
import { expect, it } from 'vitest';
import { withMongod } from './setup';

const contract = defineContract({}, ({ field, model }) => ({
  models: {
    Note: model('Note', {
      collection: 'notes',
      fields: { text: field.string() },
    }),
  },
}));

it(
  'stores a document of a model without an _id field, with the objectId _id MongoDB adds, under its validator',
  () =>
    withMongod(async ({ client, dbName }) => {
      const validator =
        contract.storage.namespaces['__unbound__']?.entries.collection?.['notes']?.validator;
      if (validator === undefined) expect.unreachable('notes has a validator');
      const db = client.db(dbName);
      await db.createCollection('notes', {
        validator: { $jsonSchema: validator.jsonSchema },
        validationLevel: validator.validationLevel,
        validationAction: validator.validationAction,
      });
      const orm = mongo({ contract, mongoClient: client, dbName }).orm;

      await orm.notes.create({ text: 'hello' });

      const stored = await db.collection('notes').find().toArray();
      expect(
        stored.map(({ _id, ...rest }) => ({ objectId: _id instanceof ObjectId, ...rest })),
      ).toEqual([{ objectId: true, text: 'hello' }]);
      expect(await orm.notes.select('text').all()).toEqual([{ text: 'hello' }]);
    }),
  timeouts.spinUpMongoMemoryServer,
);
