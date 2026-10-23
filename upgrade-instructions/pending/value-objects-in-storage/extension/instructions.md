---
changes:
  - id: mongo-result-shapes-read-storage
    summary: |
      `contractModelToMongoResultShape` and `contractFieldToMongoFieldShape` from `@prisma/orm-mongo/query-builder` take the contract's storage, `{ storage: contract.storage }` and `contract.storage`, instead of its value objects. `compileMongoQuery` from `@prisma/orm-mongo/orm` takes the contract's storage as its fifth argument. `MongoValueObjects` is removed. This replaces the rc.14 advice to pass `valueObjects`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bMongoValueObjects\b'
        - '\bcontractModelToMongoResultShape\s*\([\s\S]*?\bvalueObjects\b'
        - '\bcontractFieldToMongoFieldShape\s*\('
        - '\bcompileMongoQuery\s*\('
  - id: postgres-check-expression-types-move
    summary: |
      `PostgresCheckKind`, `PostgresCheckExpressionInput` and `PostgresCheckExpressionCandidate` are removed from `@prisma/orm-postgres/target/types`. Use `CheckExpressionInput` and `CheckExpressionCandidate` from `@prisma/orm-postgres/family-contract/check-expressions` (also exported at the same path by `@prisma/orm-mysql` and `@prisma/orm-sqlite`). A candidate's `kind` is `'membership'`, `'elementNotNull'` or the new `'valueObject'`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bPostgresCheck(?:Kind|ExpressionInput|ExpressionCandidate)\b'
---

# Value objects are storage entities

A contract keeps its value objects in storage, at `storage.namespaces.<ns>.entries.valueObject`, and a domain field names its value object by a storage coordinate. Code that read `domain.namespaces.<ns>.valueObjects` reads the storage namespaces instead.

## `mongo-result-shapes-read-storage`

```ts
// before
contractModelToMongoResultShape(model, { includes: { author: authorShape }, valueObjects });
contractFieldToMongoFieldShape(field, valueObjects);
compileMongoQuery(collection, state, storageHash, model, valueObjects);

// after
contractModelToMongoResultShape(model, { includes: { author: authorShape }, storage: contract.storage });
contractFieldToMongoFieldShape(field, contract.storage);
compileMongoQuery(collection, state, storageHash, model, contract.storage);
```

A value object field's shape is a document of its fields when `storage` holds the value object the field's coordinate names. Drop any `MongoValueObjects` type annotation; each parameter takes an object with the contract's storage `namespaces`.

## `postgres-check-expression-types-move`

```ts
// before
import type { PostgresCheckExpressionInput } from '@prisma/orm-postgres/target/types';

// after
import type { CheckExpressionInput } from '@prisma/orm-postgres/family-contract/check-expressions';
```

`postgresRenderCheckExpressions` stays in `@prisma/orm-postgres/target/types`. Its input also takes `valueObjectField`, the value object a column holds, or `undefined`.
