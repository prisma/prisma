# Dispatch b: "same type" means same data type and parameters

Read `common-rules.md` first. Plan decision 3; design 12.2. Dispatch a is done: both sides carry `dataType` and normal-form `typeParams`.

## Build

1. One equality function for column types (in schema-ir or the SQL family, where all callers reach it): two columns have the same type when both `dataType` values are defined, their ids are equal, their `typeParams` are equal as canonical JSON, and their `many` flags are equal. A column with `dataType` undefined never equals another.
2. It replaces every string comparison of type names: `SqlColumnIR.isEqualTo`; Postgres `issue-planner.ts` (`columnTypeChanged`); SQLite `issue-planner.ts`; SQLite `operations/tables.ts`; Postgres `planner-strategies.ts` (`columnTypeChangedNativeOnly`); Postgres `safe-widenings.ts` (which resolves `resolvedNativeType` through `resolveWrittenSqlTypes`; it reads the introspected column's data type id instead); Postgres `postgres-migration.ts` (the `checkType` comparison). Find any other comparison of `nativeType` or `resolvedNativeType` and replace it too.
3. The two places that parse a reported default by `resolvedNativeType` (`default-normalizer.ts`, the Postgres adapter's default reading) take the column's data type instead.
4. A type mismatch message shows the type the database reported (`reportedType.text`, plus `[]` for a list). A column whose type no data type in the stack claims gets its own message: `<column>: the database column is "<text>", which no data type in the configured stack declares`. Add an error reference entry only if it is a new code.
5. Enums per plan decision 3: compared by data type (`pg/enum`) and `typeName` from the reported schema and name, so an enum outside `public` compares equal regardless of the search path. The unbound-namespace limit stays and is tested as a known mismatch.

## Tests

Each replaced comparison has a test that fails with the old string comparison: `varchar(20)` against `character varying(20)`, `timestamptz(3)` against `timestamp(3) with time zone`, `numeric(10)` against `numeric(10,0)`, `char` against `character(1)`, an enum outside `public` with and without that schema on the search path, a list, an unclaimed type. A PGlite journey where `db verify` is clean for those columns and names the column after a raw-SQL type change.

## Done when

The golden planner test shows no DDL change; `db verify` on each committed example project against its own freshly migrated database reports no new issue (check the CLI journeys that do this). Touched packages' tests, both adapters, root `typecheck:agent`, `lint:deps`.
