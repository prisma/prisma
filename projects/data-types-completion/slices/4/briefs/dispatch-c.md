# Dispatch c: delete the type-name string machinery

Read `common-rules.md` first. Design 12.1 and 13.7; deferred items in `projects/data-types-completion/deferred.md` marked for slice 4 (naming of `dataType`; the three lookup shapes). Dispatches a and b are done.

## Build

1. `SqlColumnIR.nativeType` becomes `typeText`: on the database side the reported text, on the contract side the written name, used for display and DDL only. Nothing compares it.
2. Delete `resolvedNativeType` and `codecBaseNativeType` and their writers and readers; `codecRef` stays.
3. Delete `normalizeSchemaNativeType`, `normalizeFormattedType`, `TYPE_NAME_ALIASES`, `WITH_TIME_ZONE` (Postgres `native-type-normalizer.ts`) and `normalizeSqliteNativeType` (SQLite), with their exports from `adapter-postgres` and `adapter-sqlite` `exports/control.ts`. `introspectedNativeType` keeps only what introspection still needs (whether the column is a list, the reported text).
4. The DDL builders that take a schema IR column render the type from `column.dataType` and `typeParams` (Postgres `renderColumnDdl`/`renderColumnAlterType`; SQLite `columnSpecFromNode`/`ddlColumnFromNode`), without `SqlTypeLookups`. The path that takes a contract column keeps the lookups.
5. `CatalogColumnType.dataType` (information_schema text in `native-type-normalizer.ts`) is renamed so that `dataType` names a data type everywhere (for example `informationSchemaType`).
6. One framework type pairs a codec lookup with a data type lookup, in `@internal/framework-components`; `SqlTypeLookups`, `MongoTypeLookups` and contract-ts's local `TypeLookups` become it, and `data-type-default.ts`'s loose `codecLookup` and `dataTypeLookup` fields take it.

## Done when

The project plan's slice 4 grep checks (`projects/data-types-completion/plan.md`, "Grep checks", rows for slice 4; update the allowed output where TML-3582 and TML-3531 changed what remains, and say what you changed) return only what they allow. Golden planner test unchanged. Touched packages' tests, root `typecheck:agent`, `lint:deps`, `lint:framework-vocabulary`.
