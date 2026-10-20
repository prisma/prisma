# Dispatch a: both sides of a comparison carry a data type and normal-form parameters

Read `common-rules.md` first. Plan decisions 1 and 2; design 11.2, 11.3 and 12.1.

## Today

`SqlColumnIR` (`packages/2-sql/1-core/schema-ir/src/ir/sql-column-ir.ts`) has `dataType` (a `DataType` object, non-enumerable) set only on the contract side, by `convertColumn` in `packages/2-sql/9-family/src/core/migrations/contract-to-schema-ir.ts`. Parameters ride on `codecRef.typeParams`, as written. The introspected side has `reportedType` (Postgres: catalog text, kind, schema, name; SQLite: declared text only) and no `dataType`. `resolveReportedSqlType` (`packages/2-sql/1-core/contract/src/sql-data-type.ts`) has one production caller, `contract infer`.

## Build

1. `SqlColumnIR` gains `typeParams`: the column's data type parameters in the data type's normal form (`normalize`), or empty when the type has none. Non-enumerable like `dataType`, so JSON output and existing equality do not change in this dispatch.
2. Contract side: `convertColumn` sets `typeParams` to the normal form of the column's `dataTypeParams`.
3. Database side: one function in the SQL family resolves each introspected column's `reportedType` through `resolveReportedSqlType` over the stack's SQL data types (the list the collision check reads), and sets `dataType` (the `DataType` object, from the stack's data type lookup) and `typeParams`. A column no data type claims keeps `dataType` undefined. It runs wherever the family hands an introspected schema to verify or the planner (find every such path: `db verify`, `db init`, `db update`, `migration plan`, both migration runners' post-apply checks); infer already resolves on its own and need not change. No target code.
4. `pg/enum` (design 11.3): its `fromReported` gives `{ typeName }` from `reportedType.schema` and `.name` (bare for `public` or no schema, `schema.name` otherwise); check it does today and test it.
5. `DataTypeValue` stores normal-form parameters: `construct` in `packages/1-framework/1-core/framework-components/src/shared/data-type.ts`, `fromContract` and `valueFrom` normalise `params` with the data type's normal form before storing them. Values of `numeric(10)` and `numeric(10,0)` compare equal. If the framework `DataType` has no normal form hook and adding one is needed, add it as an optional `normalize` on the spec and have SQL data types pass theirs.

## Tests

- Unit tests of the resolution function: a base type, a parameterised type normalised (`numeric(10)` reported as `numeric(10,0)`), a list, an enum in `public` and in another schema, a domain (unclaimed), an extension type with and without its pack in the stack.
- PGlite and SQLite introspection-plus-resolution tests for a handful of columns of each.
- `DataTypeValue`: `numeric(10)` and `numeric(10,0)` values equal.

## Done when

The touched packages' tests, both adapters' tests, root `typecheck:agent`, `lint:deps`, the golden planner test (no change). No behaviour visible to a user changes yet. Report which paths call the resolution function.
