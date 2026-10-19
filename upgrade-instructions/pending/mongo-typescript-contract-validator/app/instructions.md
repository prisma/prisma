---
changes:
  - id: mongo-typescript-contract-validator
    summary: |
      A MongoDB contract written in TypeScript with `defineContract` now gets the same collection validators as a PSL contract: a closed `$jsonSchema` validator for each collection, with `validationLevel: strict` and `validationAction: error`. Its storage hash changes. Re-emit the contract, fix stored documents the validator would reject, then apply the validators with `prisma db update` or with `prisma migration plan` and `prisma db migrate`. `defineContract` now refuses a model without an `_id` stored as BSON type `objectId`, an enum a validator cannot list, a field whose codec has no MongoDB data type, and an embed relation to a model with variants.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - '@prisma/orm-mongo/contract-builder'
---

# TypeScript MongoDB contracts get collection validators

## `mongo-typescript-contract-validator`

Before, a MongoDB contract written in TypeScript had no collection validators, so MongoDB accepted any document shape. Now each collection gets the validator the same schema gets in PSL. The validator is closed: it rejects a field the model does not declare, a missing required field, and a value of the wrong BSON type.

### 1. Fix what `defineContract` now refuses

Building the contract fails for:

- a model with a collection and no `_id` field stored as BSON type `objectId`. Add `_id: field.objectId()`. MongoDB adds an `objectId` `_id` to every document it inserts without one, so a validator without it would reject every insert.
- an enum whose codec stores a BSON type a validator cannot list, such as `mongo/int64@1`, or a member whose stored value is not of that type. Use a codec stored as `string`, `int`, `double`, `bool`, `object` or `array`.
- a field whose codec no pack in the contract provides. List the extension that provides the codec in `extensions` in `defineContract`.
- an embed relation to a model with variants. The ORM reads and writes only the base fields of an embedded model.

If you wrote an enum in a TypeScript contract to avoid the validator, as earlier upgrade notes suggested, that no longer works: give the enum a codec a validator can list.

### 2. Re-emit the contract

Run `prisma contract emit`. The collections in `contract.json` gain a `validator`, and `storage.storageHash` changes.

### 3. Find stored documents the validator would reject

MongoDB does not check existing documents when it adds a validator. After it is added, every insert, and every update to a document, must produce a valid document. A stored document that does not match can no longer be updated.

For each collection, copy its `validator.jsonSchema` from `contract.json` and list the documents that do not match it, for example in `mongosh`:

```js
db.users.find({ $nor: [{ $jsonSchema: /* users validator.jsonSchema from contract.json */ }] })
```

Fix or remove those documents before you apply the validators. Writes from other applications that add fields outside the contract will fail too.

### 4. Apply the validators

Run `prisma db update`, or `prisma migration plan` followed by `prisma db migrate`. The plan has one operation per collection that adds its validator. Then run `prisma db verify`.
