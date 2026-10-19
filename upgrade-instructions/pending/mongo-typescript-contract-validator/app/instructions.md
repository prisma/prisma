---
changes:
  - id: mongo-typescript-contract-validator
    summary: |
      A MongoDB contract written in TypeScript with `defineContract` now gets the same closed collection validator as a PSL contract, and its storage hash changes once. `defineContract` refuses what a validator cannot describe: a field whose codec has no MongoDB data type, a model whose `_id` field is not stored as BSON type `objectId` (a model may leave `_id` out), an enum a validator cannot list, and an embed relation to a model with variants. MongoDB does not check existing documents when a validator is added, so find and fix the documents the validator would refuse, then apply it with `prisma db update`, or with `prisma migration plan` and `prisma db migrate`. Writing an enum in a TypeScript contract to avoid the validator, as the rc.17 notes advised, no longer works.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - '@prisma/orm-(?:mongo/contract-builder|family-mongo/contract-ts/contract-builder)'
---

# TypeScript MongoDB contracts get collection validators

## `mongo-typescript-contract-validator`

### What changes

Before, a MongoDB contract written in TypeScript had no collection validators, so MongoDB accepted any document shape. Now each collection gets the validator the same schema gets in PSL: a closed `$jsonSchema` validator with `validationLevel: strict` and `validationAction: error`. It refuses a field the model does not declare, a missing required field, and a value of the wrong BSON type. A `field.vector()` field is validated as an array. The contract's storage hash changes once, because it now includes the validators.

### What `defineContract` now refuses

Building the contract fails with one of these errors. Change the contract until it builds.

- A field whose codec has no MongoDB data type:
  `Model "Place" field "location" uses codec "geo/point@1", which no pack in the contract provides, so the collection validator cannot give its BSON type.`
  List the extension that provides the codec in `extensions` in `defineContract`.
- A model whose `_id` field is not stored as BSON type `objectId`, such as `_id: field.string()`, `field.int32()`, `field.date()`, `field.binary()` or `field.bson()`:
  `Model "User" field "_id" holds the document id as BSON type string, but an _id must be stored as BSON type objectId: every collection validator requires an objectId _id, which MongoDB adds to every document inserted without one.`
  Declare `_id: field.objectId()` (or a field of another name stored as `_id`, such as `id: field.objectId().mongo({ field: '_id' })`), or leave `_id` out: every collection validator requires an `objectId` `_id`, and MongoDB adds one to each document inserted without it. If the collection already holds documents with another `_id`, follow [Keeping documents whose `_id` is not an ObjectId](#keeping-documents-whose-_id-is-not-an-objectid) first.
- An enum a validator cannot list:
  `enumType("Level") codec "mongo/int64@1" stores BSON type long, which a collection validator cannot list as an enum value. Use a codec whose BSON type is string, int, double, bool, object or array.`
  A member whose stored value is not of that type is refused too: `enumType("Ratio") member "All" is stored as "1", which a collection validator cannot list as a double. A member of a double enum must be a finite number.`
- An embed relation to a model with variants:
  `Relation "Owner.task" embeds model "Task", which has variants. The ORM reads and writes only the base fields of an embedded model, so an embedded model cannot have variants.`

The rc.17 upgrade notes advised writing an enum over a codec such as `mongo/int64@1` or `mongo/date@1` in a TypeScript contract, which had no validator. That no longer works: give the enum a codec whose BSON type is string, int, double, bool, object or array.

### Keeping documents whose `_id` is not an ObjectId

MongoDB cannot change a document's `_id` in place. To keep the data of a collection whose documents have another `_id`, copy each document into a new document with an `objectId` `_id`, before you apply the validator. For example, for collection `events`, keeping the old id in a field `legacyId`.

Stop the applications that write to `events`, or to a collection that refers to it, until step 4 is done. A document written to `events` after step 2 is lost in step 4.

1. In the contract, declare `_id: field.objectId()` (or leave `_id` out). If code still uses the old id, add `legacyId: field.string().optional()` (with the old `_id`'s field type), optional so new documents can leave it out. Change every field that refers to the model by its id to `field.objectId()`, for example `eventId` on a model with `rel.belongsTo(Event, { from: 'eventId', to: Event.ref('_id') })`.
2. In `mongosh`, create the new collection with the options of `events`, such as its collation, then copy the documents into it with new ids:

   ```js
   db.createCollection('events_copy', db.getCollectionInfos({ name: 'events' })[0].options);
   db.events.find().forEach((doc) => {
     const { _id, ...rest } = doc;
     db.events_copy.insertOne({ ...rest, legacyId: _id });
   });
   ```

   The options include every collection option MongoDB keeps, including a collation, `capped`, a clustered index, time-series options and change stream pre- and post-images. They also include a validator if `events` has one; a contract written in TypeScript gave it none.

3. Change every document that refers to an event by its old id to refer to its new `_id`, looking it up by `legacyId`. For documents of collection `tickets` whose `eventId` holds the old id:

   ```js
   db.events_copy.find().forEach((event) => {
     db.tickets.updateMany({ eventId: event.legacyId }, { $set: { eventId: event._id } });
   });
   ```

4. Replace the old collection with the copy: `db.events_copy.renameCollection('events', true)`. This drops the old collection and its indexes; step 4 of [Steps](#steps) creates the contract's indexes again. MongoDB cannot rename a time-series collection; for one, instead drop `events`, create it again with the options you read in step 2, copy the documents back from `events_copy`, and drop `events_copy`.

### The risk: documents already stored

MongoDB does not check existing documents when a validator is added. After it is added, every insert, and every update to a document, must produce a valid document. A stored document that does not match the validator can no longer be updated, and writes from other applications that add fields outside the contract fail.

To keep a collection without a validator, for example because other applications write fields the contract does not declare, give its model a control policy other than `managed`. With `controlPolicy: 'observed'`, Prisma creates and changes nothing in that collection, so it adds no validator, and `prisma db verify` reports the collection's differences from the contract as warnings:

```ts
const Event = model('Event', {
  collection: 'events',
  controlPolicy: 'observed',
  fields: { _id: field.objectId(), name: field.string() },
});
```

`defaultControlPolicy: 'observed'` in `defineContract` does the same for every collection. Such a collection is not created by Prisma either, so create it yourself.

### Steps

1. Run `prisma contract emit`. Each collection in `contract.json` gains a `validator`, and `storage.storageHash` changes.
2. List the documents each validator would refuse. In `mongosh`, connected to your database, run this from the directory of the emitted `contract.json` (change the path if it is elsewhere):

   ```js
   const contract = JSON.parse(require('fs').readFileSync('contract.json', 'utf8'));
   for (const namespace of Object.values(contract.storage.namespaces)) {
     for (const [name, collection] of Object.entries(namespace.entries.collection ?? {})) {
       if (collection.validator === undefined) continue;
       const refused = db
         .getCollection(name)
         .find({ $nor: [{ $jsonSchema: collection.validator.jsonSchema }] })
         .toArray();
       print(name, refused.length, refused);
     }
   }
   ```

3. Fix each listed document so it matches its model, or move it to another collection. Run step 2 again until every collection lists 0 documents.
4. Apply the validators: run `prisma db update`, or run `prisma migration plan` from the migration the database is at (`--from <its directory name>` if the project has no `db` ref) followed by `prisma db migrate`. The plan has one `widening` operation per collection, `validator.<collection>.add`, which adds its validator.
5. Run `prisma db verify`. It reports no problems.
