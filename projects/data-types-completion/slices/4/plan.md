# Slice 4 plan: `db verify` and the planner compare column types through data types (TML-3387)

Design: `projects/data-types-completion/design.md` sections 11.2, 11.3, 12.1 to 12.3 and 13.8 (12.4 and the rest of 11 and 13 are done: TML-3582 and TML-3531). Branch `tml-3387-verify-through-data-types`, from `main` at `90959561c4`. Ticket TML-3387.

## Outcome

```sql
CREATE TABLE "user" (name character varying(20));
```

with a contract column `name VarChar(20)`:

- Today `db verify` and the planner decide "same type" by comparing type-name strings. The contract side says `varchar(20)`, the database says `character varying(20)`, and a set of normalising tables (`normalizeSchemaNativeType`, `TYPE_NAME_ALIASES`, `WITH_TIME_ZONE`, `normalizeFormattedType`) makes the two strings equal.
- After this slice both sides carry a data type and its parameters: the contract side from the column's codec, the database side by resolving what the database reports through the stack's data types. Both are `pg/varchar` with `{ length: 20 }`, so they are equal, and the normalising tables are deleted.
- A column whose reported type no data type in the stack claims never equals anything, and the mismatch names the type the database reported: `public.user.name: the database column is "hstore", which no data type in the configured stack declares`.

## What the code does today

From an inventory of `main` on 2026-10-19:

- `SqlColumnIR` carries `nativeType`, `resolvedNativeType`, `codecBaseNativeType`, `codecRef`, `dataType` (a `DataType` object), `reportedType` and `many`. It has no `typeParams` field; parameters ride on `codecRef.typeParams`.
- The contract side (`contract-to-schema-ir.ts`) sets `dataType`. The introspected side never does: `resolveReportedSqlType` has one production caller, `contract infer`.
- "Same type" is a string comparison in seven places: `SqlColumnIR.isEqualTo`, both targets' issue planners, SQLite `operations/tables.ts`, Postgres `planner-strategies.ts` (`columnTypeChangedNativeOnly`), `safe-widenings.ts` and `postgres-migration.ts`. Default parsing reads `resolvedNativeType` in two places.
- The Postgres `ALTER COLUMN TYPE` postcheck uses `alterTypeCheckText` and `catalogTypeTextIfReadable`, through `resolveWrittenSqlTypes`. `buildExpectedFormatType` is exported but only tests call it.
- An enum column compares the contract's `typeName` with the database's `format_type` text. `format_type` qualifies the name only when its schema is outside the search path, so an enum outside `public` matches only when both sides happen to agree.
- `EXISTING_COLUMN_DATE_TIME_TYPES` is read only by the Prisma 7 type table, and every entry of that table already names the constructor marked `inferred` for its data type.
- `DataTypeValue` stores its parameters as written, so `numeric(10)` and `numeric(10,0)` values compare unequal.
- Three identical shapes pair a codec lookup with a data type lookup: `SqlTypeLookups`, `MongoTypeLookups`, and a local `TypeLookups` in contract-ts; `data-type-default.ts` takes the two as loose fields.
- The golden planner test records the DDL planned for every committed contract (364 entries). Other tests import its two fixture contracts and two released upgrade-instruction tests read its `planned.golden.json`.

## Decisions taken in this plan

These follow from the design; I am stating them, not asking.

1. **Where the database side is resolved.** In the SQL family, right after introspection, over the stack's data types: one function, no target code. The adapters keep reporting `reportedType` as they do.
2. **Parameters are compared in their normal form** on both sides, and `DataTypeValue` stores normal-form parameters too (the deferred item), so `numeric(10)` and `numeric(10,0)` are one type and one value.
3. **Enums outside `public`.** The database side's enum name comes from `reportedType.schema` and `.name`, not from `format_type`, so it no longer depends on the search path. A column in the unbound namespace whose enum lives outside `public` still does not compare equal; that limit is documented, as the design says.
4. **The golden planner test is retired, its fixtures stay.** The test and its manifest are deleted in the last dispatch. The two fixture contracts and `planned.golden.json` stay where they are, because the contract-parity tests and two released upgrade-instruction tests use them.
5. **The Prisma 7 type table** names a data type and parameters per entry and prints that data type's marked constructor (design 13.8). The project that also changes the Prisma 7 reader, "Storage a model does not map", has closed, so nothing conflicts.

## Dispatches

| | What | Done when |
| --- | --- | --- |
| a | Resolve the database side: the SQL family resolves each introspected column's `reportedType` into `dataType` and normal-form `typeParams`; the contract side gets normal-form `typeParams` too. `DataTypeValue` stores normal-form parameters. | Unit tests per kind (base type, parameterised, list, enum in and outside `public`, domain, unclaimed); introspection tests over PGlite and SQLite. |
| b | Compare through data types: one equality function (same data type id, equal normal-form parameters, same `many`) replaces the seven string comparisons and the two default-parsing reads of `resolvedNativeType`. A column with no data type never equals another, and the mismatch names the reported text. Enum comparison per decision 3. | Each comparison site has a test that fails with the old string comparison; the golden planner test shows no DDL change. |
| c | Delete the string machinery: `nativeType` becomes `typeText` (display and DDL only); `resolvedNativeType`, `codecBaseNativeType`, `normalizeSchemaNativeType`, `normalizeFormattedType`, `normalizeSqliteNativeType`, `TYPE_NAME_ALIASES`, `WITH_TIME_ZONE` are deleted. The DDL builders render from the column's data type and parameters. `CatalogColumnType.dataType` (information_schema text) is renamed so `dataType` means one thing. One framework type pairs the codec and data type lookups. | The project plan's slice 4 grep checks return only what they allow. |
| d | The `ALTER COLUMN TYPE` postcheck: a type that claims a kind (enums) is compared by identity, `atttypid = to_regtype(...)`, or its array type for lists; every other type compares `format_type` with `renderSqlCatalogText` plus `[]`. `buildExpectedFormatType`, `catalogTypeTextIfReadable` and helpers only they use are deleted. | PGlite tests: every data type changed to another passes its postcheck; an enum in another schema too. |
| e | The Prisma 7 type table names data types; the reader prints each one's marked constructor with the fewest arguments; `EXISTING_COLUMN_DATE_TIME_TYPES` is deleted. | Prisma 7 reader tests and the `prisma7-source` journeys unchanged in output. |
| f | Journeys and close-out: a test-only extension declaring `testext/thing` with a parameter, created by raw SQL, then introspected, verified and inferred, and a second run without the extension expecting the mismatch and the infer failure; against PGlite and SQLite, every data type with a constructor, as a column and a list, migrated then verified clean; every enum case. Retire the golden planner test per decision 4. ADR 254's comparison sections and the error reference. | All checks; manual QA below. |

## Must not change

Committed `contract.json`, `contract.d.ts`, migrations and snapshots; DDL (the golden test shows no change through dispatch e). Verify's result on any committed example against its own database.

## Manual QA

Against PostgreSQL 17 and SQLite with the CLI built from the branch: a project with a column of every data type (including `varchar` versus `character varying`, `timestamp(3) with time zone`, `numeric(10)` against a database `numeric(10,0)`, an enum in `public` and one in another schema, a pgvector column), `db verify` clean; then change one column's type by raw SQL and check verify names that column with the reported type; then `migration plan` and `db migrate` apply the change and the postcheck passes. A database column of a type no pack declares is reported by name.

## Halt conditions

- A committed contract or any DDL changes.
- A real database reports a type that has a data type but no claiming text matches it.
- `db verify` on a committed example against its own database reports an issue it did not report before.

## Not in this slice

- TML-3389: function arguments, enum member values and discriminator values under the cast rule.
- ADR 273's raw columns (a column of a type no data type claims), which have their own ticket.
- TML-3586: adopting a database whose PostGIS extension already exists.
