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
  - id: field-types-read-storage-value-objects
    summary: |
      In `@prisma/orm-framework/contract/types`, `ValueObjectTypesFromDomain` is now `ValueObjectTypesFromStorage`, which takes the contract's storage namespaces. `FieldTypesFromDomain` takes the storage namespaces as a new sixth argument, `Contract['storage']['namespaces']`. It defaults to none, so code that still passes five arguments types no value object field: such a field gets no type. An override for a value object field is keyed by the value object's storage namespace, at `[storage namespace]['valueObjects'][valueObject][field]`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bValueObjectTypesFromDomain\b'
        - '\bFieldTypesFromDomain\s*<'
  - id: value-object-reference-type
    summary: |
      In `@prisma/orm-framework/contract/types`, `ValueObjectFieldType` is renamed `ValueObjectReference`: the type of a field that refers to a value object, which is now the value object's storage coordinate. `ContractValueObjectField` stays the type of a value object's own field.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bValueObjectFieldType\b'
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

## `field-types-read-storage-value-objects`

```ts
// before
import type { FieldTypesFromDomain, ValueObjectTypesFromDomain } from '@prisma/orm-framework/contract/types';
type Fields = FieldTypesFromDomain<Contract['domain']['namespaces'], CodecTypes, Parameterized, Overrides, 'output'>;
type ValueObjects = ValueObjectTypesFromDomain<Contract['domain']['namespaces'], CodecTypes, Parameterized, Overrides, 'output'>;

// after
import type { FieldTypesFromDomain, ValueObjectTypesFromStorage } from '@prisma/orm-framework/contract/types';
type Fields = FieldTypesFromDomain<Contract['domain']['namespaces'], CodecTypes, Parameterized, Overrides, 'output', Contract['storage']['namespaces']>;
type ValueObjects = ValueObjectTypesFromStorage<Contract['storage']['namespaces'], CodecTypes, Parameterized, Overrides, 'output'>;
```

Pass the sixth argument whenever the contract has value objects. A model field's override stays at `[namespace]['models'][model][field]`. A value object field's override moves to the namespace the value object is stored in: on SQL that is usually the model's namespace, and on MongoDB it is `__unbound__`.

## `value-object-reference-type`

```ts
// before
import type { ValueObjectFieldType } from '@prisma/orm-framework/contract/types';
const reference: ValueObjectFieldType = { kind: 'valueObject', name: 'Address' };

// after
import type { ValueObjectReference } from '@prisma/orm-framework/contract/types';
const reference: ValueObjectReference = {
  kind: 'valueObject',
  plane: 'storage',
  namespaceId: 'public',
  entityKind: 'valueObject',
  entityName: 'Address',
};
```
