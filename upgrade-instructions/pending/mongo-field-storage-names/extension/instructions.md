---
changes:
  - id: mongo-model-storage-fields
    summary: |
      A MongoDB model's `fields` are keyed by field name, and `model.storage.fields` records the key each field is stored under: `MongoModelStorage` gains a required `fields: Record<string, { field: string }>`, with an entry for every field. `on.localFields`, `on.targetFields` and `discriminator.field` name fields; indexes, validators and execution default refs name stored keys. Code that read `model.fields` keys as document keys reads stored keys through the helpers `@internal/mongo-contract` exports: `storedFieldNamesOf`, `storedFieldNameOf`, `fieldOfStoredName`, `documentIdFieldOf` and `hierarchyStoredFieldNamesOf`. A hand-built MongoDB contract or model storage type adds `fields`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,json}"
      matches:
        - 'MongoModelStorage|MongoModelDefinition'
        - '"storage"\s*:\s*\{\s*(?:"collection"\s*:\s*"[^"]*"\s*)?\}'
        - '(?<![\w$])storage\s*:\s*\{\s*(?:readonly\s+)?collection\s*:\s*[''"][^''"]*[''"]\s*;?\s*\}'
---

## `mongo-model-storage-fields`

```ts
// before
const keys = Object.keys(model.fields);
const hasId = Object.hasOwn(model.fields, '_id');

// after
import { documentIdFieldOf, storedFieldNamesOf } from '@internal/mongo-contract';

const keys = Object.values(storedFieldNamesOf(model));
const hasId = documentIdFieldOf(model) !== undefined;
```

`storedFieldNamesOf(model)` maps each of a model's own fields to its stored key; a value object, which has no storage block, maps each field to its own name. `hierarchyStoredFieldNamesOf(models, name)` adds the fields a variant inherits from its base. A model built by hand, for example in a test, adds `fields` to its storage:

```ts
// before
{ fields: { _id: objectIdField, email: stringField }, relations: {}, storage: { collection: 'users' } }

// after
{
  fields: { _id: objectIdField, email: stringField },
  relations: {},
  storage: { collection: 'users', fields: { _id: { field: '_id' }, email: { field: 'email' } } },
}
```
