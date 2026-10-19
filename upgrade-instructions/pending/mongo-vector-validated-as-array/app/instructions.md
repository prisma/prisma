---
changes:
  - id: mongo-vector-validated-as-array
    summary: |
      A MongoDB field of codec `mongo/vector@1` is now validated as BSON type `array`, the type its values are stored as. Before, the collection validator listed BSON type `vector`, which MongoDB's `$jsonSchema` does not know, so such a validator could not be applied. Every contract with a vector field changes its validator and its storage hash: re-emit the contract and apply it with `prisma db update`, or with `prisma migration plan` and `prisma db migrate`.
    detection:
      glob: "**/contract.json"
      matches:
        - '"codecId":\s*"mongo/vector@1"'
---

# A MongoDB vector field is validated as an array

## `mongo-vector-validated-as-array`

A field of codec `mongo/vector@1` (`field.vector()` in TypeScript) stores its value as an array of numbers. Its collection validator now gives it BSON type `array`. Before, it gave BSON type `vector`, which MongoDB refuses in a `$jsonSchema`, so `prisma db update`, `prisma db init` and `prisma db migrate` failed with `Unknown type name alias: vector`.

Run `prisma contract emit`. The collection's `validator` and `storage.storageHash` in `contract.json` change. Then apply the validator with `prisma db update`, or with `prisma migration plan` followed by `prisma db migrate`, and run `prisma db verify`.
