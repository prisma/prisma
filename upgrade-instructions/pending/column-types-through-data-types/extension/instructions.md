---
changes:
  - id: type-lookups-one-framework-type
    summary: |
      `SqlTypeLookups` (from the SQL contract's `data-type` entry point) and `MongoTypeLookups` (from the Mongo contract's `data-type` entry point) are removed. Use `TypeLookups` from `@prisma/orm-framework/components/codec`, the same pair of `codecLookup` and `dataTypeLookup`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\b(?:SqlTypeLookups|MongoTypeLookups)\b'
  - id: type-name-normalisers-removed
    summary: |
      `normalizeSchemaNativeType` (Postgres target `native-type-normalizer` entry point and Postgres adapter `control` entry point) and `normalizeSqliteNativeType` (SQLite adapter `control` entry point) are removed. Columns are compared by their data type and its parameters, so no type name needs normalising.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\b(?:normalizeSchemaNativeType|normalizeSqliteNativeType)\b'
  - id: introspected-type-text
    summary: |
      In the Postgres target's `native-type-normalizer` entry point, `introspectedNativeType` is renamed `introspectedTypeText` and `IntrospectedNativeType` is renamed `IntrospectedTypeText`; its result holds `typeText` (the type the database reports) and `many`, and no `resolvedNativeType`. `CatalogColumnType.dataType` is renamed `informationSchemaType`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\b(?:introspectedNativeType|IntrospectedNativeType|CatalogColumnType)\b'
  - id: schema-ir-column-type-text
    summary: |
      `SqlColumnIR` and `SqlColumnIRInput` (`@prisma/orm-family-sql/schema-ir/types`): `nativeType` is renamed `typeText`, and `resolvedNativeType` and `codecBaseNativeType` are removed. A column's type is its `dataType`, `storedType` and `typeParams`; `typeText` is for display only.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\b(?:resolvedNativeType|codecBaseNativeType)\b'
        - '(?<![\s\S])(?=[\s\S]*\bSqlColumnIR)[\s\S]*\bnativeType\b'
  - id: default-resolver-takes-the-column
    summary: |
      A `DefaultResolver` receives the column, `{ nativeType, many }`, as its second argument instead of a type name with a `[]` suffix for a list, and `readPostgresDefault(raw, many)` takes whether the column is a list instead of a type name.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bDefaultResolver\b'
        - '\breadPostgresDefault\s*\('
---

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

`normalizeSchemaNativeType` and `normalizeSqliteNativeType` are gone. If you used them to decide whether two columns have the same type, compare the columns' data types instead, with `sqlColumnTypesEqual(a, b)` from `@prisma/orm-family-sql/schema-ir/types`: two columns have the same type when both have a `storedType`, the two are one data type, their `typeParams` are equal, and both or neither are lists.

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

`typeText` is the type exactly as the database reports it, such as `integer` or `timestamp(3) with time zone`, not a normalised name.

## `schema-ir-column-type-text`

```ts
// Before
new SqlColumnIR({ name: 'id', nativeType: 'int4', nullable: false, resolvedNativeType: 'int4' });

// After
new SqlColumnIR({ name: 'id', typeText: 'int4', nullable: false });
```

Read `column.typeText` where you read `column.nativeType`. Code that compared `resolvedNativeType` compares types with `sqlColumnTypesEqual` instead. Code that read `codecBaseNativeType` to write DDL writes the type from `column.storedType` and the parameters in `column.codecRef.typeParams`, with `renderSqlTypeName` from the SQL contract's `data-type` entry point.

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
