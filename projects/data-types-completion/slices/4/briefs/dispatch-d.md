# Dispatch d: the ALTER COLUMN TYPE postcheck from data type declarations

Read `common-rules.md` first. Design 12.3. Dispatches a to c are done.

## Today

The postcheck after `ALTER COLUMN TYPE` is built by `alterTypeCheckText` and `catalogTypeTextIfReadable` (`packages/3-targets/3-targets/postgres/src/core/migrations/planner-sql-checks.ts`), through `resolveWrittenSqlTypes`, called from `op-factory-call.ts` (four places) and `postgres-migration.ts`. `buildExpectedFormatType` is exported but called only by tests; it uses `quoteIdentifierWhereNeeded` and `POSTGRES_QUOTED_KEYWORDS`.

## Build

1. For a data type with `claimsKind` (enums), the postcheck compares by identity: `a.atttypid = to_regtype('<render(params)>')`, or for a list the element type's array type through `typarray`.
2. For every other type it compares `format_type(a.atttypid, a.atttypmod)` with `renderSqlCatalogText(type, params)`, plus `[]` for lists.
3. Delete `buildExpectedFormatType`, `catalogTypeTextIfReadable`, and any helper or export only they used (check `quoteIdentifierWhereNeeded` and `POSTGRES_QUOTED_KEYWORDS` for other callers first). Released upgrade-instruction code that calls them, if any, stays as it is.

## Tests

PGlite: for every Postgres data type with a constructor, a column changed to it from another type by a planned migration passes its postcheck, as a column and a list; an enum in `public`, in another schema, with a quoted name, and an enum list. A postcheck that should fail (type left unchanged) fails.

## Done when

Golden planner test: the postcheck SQL in recorded operations may change; list every changed line and check each against PGlite. No DDL statement changes. Touched packages' tests, root `typecheck:agent`, `lint:deps`.
