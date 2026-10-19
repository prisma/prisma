---
changes:
  - id: type-lookups-one-framework-type
    summary: |
      `SqlTypeLookups` (from `@prisma/orm-family-sql/contract/data-type`) and `MongoTypeLookups` (from `@prisma/orm-family-mongo/contract/data-type`) are removed. Use `TypeLookups` from `@prisma/orm-framework/components/codec`, the same pair of `codecLookup` and `dataTypeLookup`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\b(?:SqlTypeLookups|MongoTypeLookups)\b'
  - id: type-name-normalisers-removed
    summary: |
      `normalizeSchemaNativeType` (from `@prisma/orm-postgres/target/native-type-normalizer` and `@prisma/orm-postgres/adapter/control`) and `normalizeSqliteNativeType` (from `@prisma/orm-sqlite/adapter/control`) are removed. Columns are compared by their data type and its parameters, so no type name needs normalising.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\b(?:normalizeSchemaNativeType|normalizeSqliteNativeType)\b'
  - id: introspected-type-text
    summary: |
      In `@prisma/orm-postgres/target/native-type-normalizer`, `introspectedNativeType` is renamed `introspectedTypeText` and `IntrospectedNativeType` is renamed `IntrospectedTypeText`; its result holds `typeText` (the type the database reports) and `many`, and no `resolvedNativeType`. `CatalogColumnType.dataType` is renamed `informationSchemaType`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\b(?:introspectedNativeType|IntrospectedNativeType|CatalogColumnType)\b'
  - id: schema-ir-column-type-text
    summary: |
      `SqlColumnIR` and `SqlColumnIRInput` (`@prisma/orm-family-sql/schema-ir/types`): `nativeType` is renamed `typeText`, and `resolvedNativeType` and `codecBaseNativeType` are removed. A column's type is its `storedType` and `storedTypeParams`; nothing compares `typeText`. A column built by hand compares equal to another only when it has `storedType` and `storedTypeParams`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\b(?:resolvedNativeType|codecBaseNativeType)\b'
        - '(?<![\s\S])(?=[\s\S]*\bSqlColumnIR)[\s\S]*\bnativeType\b'
  - id: default-resolver-takes-the-column
    summary: |
      A `DefaultResolver` (`@prisma/orm-family-sql/family/control`) receives the column, `{ typeText, many }`, as its second argument instead of a type name with a `[]` suffix for a list, and `readPostgresDefault(raw, many)` (`@prisma/orm-postgres/target/default-normalizer`) takes whether the column is a list instead of a type name.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bDefaultResolver\b'
        - '\breadPostgresDefault\s*\('
  - id: alter-type-postcheck-by-data-type
    summary: |
      In `@prisma/orm-postgres/target/planner-sql-checks`, `buildExpectedFormatType` and `alterTypeCheckText` are removed. `alterTypeCheck(type, dataTypes, where)` returns how the `ALTER COLUMN TYPE` postcheck recognises the new type, a `ColumnTypeCheck`: `{ kind: 'catalog-text', text }`, the text `format_type` prints, or for an enum `{ kind: 'identity', typeName, many }`, checked with `to_regtype` whatever schema the enum is in. The `checkType` field of `AddColumnCall`, `AlterColumnTypeCall`, `AddRequiredColumnToEmptyTableCall` and `AddColumnWithTemporaryDefaultCall` (`@prisma/orm-postgres/target/op-factory-call`) is now a `ColumnTypeCheck` instead of a string.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\b(?:buildExpectedFormatType|alterTypeCheckText)\b'
---

## `alter-type-postcheck-by-data-type`

```ts
// Before
const checkText = alterTypeCheckText('"app"."status"', dataTypes, where); // 'app.status'

// After
const check = alterTypeCheck('"app"."status"', dataTypes, where);
// { kind: 'identity', typeName: '"app"."status"', many: false }
```

A check of kind `catalog-text` holds the text `buildExpectedFormatType` gave for the same type. Code that read `call.checkType` as a string reads `call.checkType.text` for a `catalog-text` check and `call.checkType.typeName` for an `identity` check.

## `type-lookups-one-framework-type`

The pair of a codec lookup and a data type lookup has one type in the framework. Replace `SqlTypeLookups` and `MongoTypeLookups` with `TypeLookups`:

```ts
// Before
import type { SqlTypeLookups } from '@prisma/orm-family-sql/contract/data-type';
function storageTypeOf(codecId: string, lookups: SqlTypeLookups) {}

// After
import type { TypeLookups } from '@prisma/orm-framework/components/codec';
function storageTypeOf(codecId: string, lookups: TypeLookups) {}
```

`TypeLookups` asks only for `codecLookup.descriptorFor` and `dataTypeLookup.get`. Where your code needs the whole lookups, name them as type arguments: `TypeLookups<CodecLookupWithDescriptors, DataTypeLookup>`.

## `type-name-normalisers-removed`

`normalizeSchemaNativeType` and `normalizeSqliteNativeType` are gone. If you used them to decide whether two columns have the same type, compare the columns' data types instead, with `sqlColumnTypesEqual(a, b)` from `@prisma/orm-family-sql/schema-ir/types`: two columns have the same type when both have a `storedType`, the two are one data type, their `storedTypeParams` are equal, and both or neither are lists.

## `introspected-type-text`

```ts
// Before
const { nativeType, many, resolvedNativeType } = introspectedNativeType({
  formattedType, dataType: row.data_type, udtName, characterMaximumLength, numericPrecision, numericScale,
});

// After
const { typeText, many } = introspectedTypeText({
  formattedType, informationSchemaType: row.data_type, udtName, characterMaximumLength, numericPrecision, numericScale,
});
```

On the database side, `typeText` is the type as introspection reads it, such as `integer` or `timestamp(3) with time zone`, not a normalised name. On Postgres an enum is named as a contract names it (`mood`, or `app.status` outside `public`) and a type off the search path keeps its schema (`extensions.vector(3)`); on SQLite the declared type is lower-cased. On the contract side it is the name a migration writes.

## `schema-ir-column-type-text`

```ts
// Before
new SqlColumnIR({ name: 'id', nativeType: 'int4', nullable: false, resolvedNativeType: 'int4' });

// After
import { pgInt4 } from '@prisma/orm-postgres/target/data-types';

new SqlColumnIR({
  name: 'id',
  typeText: 'int4',
  nullable: false,
  storedType: pgInt4,
  storedTypeParams: {},
});
```

A column with no `storedType` is one no data type claims, and it never compares equal to another, so a column a test builds by hand to compare needs `storedType` and `storedTypeParams`: the data type the column is stored as (the type its codec represents, unless that type is stored as another), and that type's parameters in normal form, such as `{ precision: 10, scale: 0 }` for `numeric(10)`. `storedTypeParams` is only for comparing; DDL writes the parameters as written, from `codecRef.typeParams`.

Read `column.typeText` where you read `column.nativeType`. Code that compared `resolvedNativeType` compares types with `sqlColumnTypesEqual` instead. Code that read `codecBaseNativeType` to write DDL writes the type from `column.storedType` and the parameters in `column.codecRef.typeParams`, with `renderSqlTypeName` from `@prisma/orm-family-sql/contract/data-type`.

## `default-resolver-takes-the-column`

```ts
// Before
const resolve: DefaultResolver = (def, resolvedNativeType) =>
  read(def, resolvedNativeType.endsWith('[]'));
readPostgresDefault(raw, 'text[]');

// After
const resolve: DefaultResolver = (def, column) => read(def, column.many);
readPostgresDefault(raw, true);
```
