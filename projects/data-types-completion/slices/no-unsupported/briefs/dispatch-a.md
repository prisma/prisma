# Dispatch a: introspection reports each column's type as the database reports it

Read `common-rules.md` first. Design: section 11.1 of `projects/data-types-completion/design.md`.

## Why

`contract infer` will look up each column's type with `resolveReportedSqlType` (`packages/2-sql/1-core/contract/src/sql-data-type.ts`). That function matches the catalog text Postgres reports (`integer`, `timestamp(3) with time zone`). Postgres introspection today stores a list column's element type in written form (`int4`, `timestamptz(3)`) through `normalizeSchemaNativeType` (`packages/3-targets/3-targets/postgres/src/core/native-type-normalizer.ts`), and written texts are not claiming texts. Infer needs the reported text, and the type's kind, schema and name.

## Build

1. Postgres introspection (`packages/3-targets/6-adapters/postgres/src/core/control-adapter.ts`, the column query near `format_type(a.atttypid, a.atttypmod)`) gives each introspected column a `ReportedSqlType` (the interface already in `sql-data-type.ts`), in a new optional field of the schema IR column (`packages/2-sql/1-core/schema-ir`), named `reportedType`:
   - `text`: `format_type` of the element type for an array column (the type's `typelem`, with the column's `atttypmod`), otherwise of the type itself. Not normalised.
   - `kind`: from the element type's `typtype`: `'e'` enum, `'d'` domain, `'c'` composite, `'r'` range, `'m'` multirange, `'b'` and anything else `undefined`.
   - `schema`: the element type's `nspname`. `name`: its `typname`, unquoted.
   - When `kind` is undefined and `schema` is not `pg_catalog`, remove a leading `<schema>.` from `text`, quoted as `format_type` quotes it. Supabase installs `vector` in the `extensions` schema, so `format_type` reports `extensions.vector(3)` when that schema is not on the search path.
   Existing fields (`nativeType`, `many`, `resolvedNativeType`) and verify do not change.
2. SQLite introspection sets `reportedType` to `{ text: <PRAGMA table_info type>, kind: undefined, schema: undefined, name: undefined }`.
3. The resolver's placeholder pattern accepts an optional leading minus for a parameter whose schema allows a negative integer, so `numeric(10,-2)` resolves to `pg/numeric` with scale `-2`. Placeholders whose schema forbids negatives still match digits only.
4. Every other producer of a schema IR column that would need the field (test helpers, fixtures) is left alone: the field is optional.

## Tests

- PGlite introspection tests: a base type, a parameterised type, a list of a parameterised type (`numeric(10,2)[]` gives text `numeric(10,2)`), an enum and an enum list (kind `enum`), a domain (kind `domain`), a type in a schema not on the search path (create a type in schema `extensions`; a composite will do for the kind, and for the prefix removal use a base type the test can create, or explain in the report why no base type can be created in PGlite and test the prefix removal as a unit of the function that builds `ReportedSqlType`).
- Resolver unit tests for `numeric(10,-2)` and for a negative value in a placeholder whose schema forbids it (no match).
- One SQLite introspection test.

## Report

What `format_type` returned for each case in your PGlite tests, verbatim.
