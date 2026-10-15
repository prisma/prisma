# Dispatch c: `contract infer` and `contract print` pick types through data types

Read `common-rules.md` first. Design: sections 13.2, 13.3, 13.4 and 13.7. Dispatches a and b are done: each introspected Postgres column carries `reportedType`, and `Bit`, `VarBit`, `Interval` exist.

## Today

`packages/3-targets/3-targets/postgres/src/core/psl-infer/infer-psl-contract.ts` builds a `PslTypeMap` with `createPostgresTypeMap` (`psl-build/postgres-type-map.ts`), and `infer-model-blocks.ts` `buildScalarField` resolves `column.nativeType` through it, printing `Unsupported("...")` when the tables have no entry. `contract print` (`psl-print/column-types.ts`, `typeMapCall`) asks the same tables first, then falls back to the first stack constructor that reproduces the column. The infer hook already receives `context: SqlPslBuildContext` with `authoringContributions`, `codecLookup` and `dataTypes` (`packages/2-sql/9-family/src/core/control-instance.ts`).

## Build

1. A function in the Postgres target that, given the stack's authoring contributions, codec lookup and a data type id, returns the constructor marked `inferred` for that data type: the constructor whose output codec's data type is that id. Namespaced constructors (`pgvector.Vector`, `postgis.Geometry`) are found with their path.
2. A function that prints the call for resolved parameters: the fewest arguments `p` such that the data type's `normalize(p)` equals the resolved parameters, dropping arguments from the end of the constructor's list while equality holds (design 13.3). `numeric(10,0)` prints `Numeric(10)`; bare `character(1)` prints `Char`; `numeric(10,2)` prints `Numeric(10, 2)`.
3. Infer: for each column that is not an enum (keep today's `pg.enum(Name)` path and any other path that does not go through the type map, such as domain enums), resolve `column.reportedType` with `resolveReportedSqlType` over `context.dataTypes`, and print the marked constructor with the arguments of item 2; lists keep `[]`. The default checks (`infer-default-codec.ts`) receive the printed name and arguments as today.
4. A column whose type no data type claims, or whose data type has no marked constructor, is collected. After all tables are walked, if any were collected, infer throws `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED` and prints nothing. Message: `contract infer: no data type in the configured stack claims these column types:` followed by one line per column, `<schema>.<table>.<column>: <reported text>` (list columns add `[]`), sorted. `why`: Prisma 8 reads a column type only through a data type that the target or an extension pack declares. `fix`: add the extension pack that declares the type to `extensionPacks` in the config, or change the column to a type Prisma 8 supports. `meta.columns`: the list. Add the code to `docs/reference/error-reference.md` in the form of its neighbours (see `CONTRACT.INFER_UNSUPPORTED`).
5. Print: `typeMapCall` becomes the marked constructor of the column's data type, built so it produces exactly the column's codec and type parameters, else today's fallback. Print output must not change for any existing test; if one changes, stop and report.
6. Delete `POSTGRES_TO_PSL`, `PRESERVED_NATIVE_TYPES`, `PARAMETERIZED_NATIVE_TYPES`, `INFERRED_PSL_TYPE_NAMES`, `createPostgresTypeMap`, `postgres-type-map.ts`, the `PslTypeMap`, `PslTypeResolution` and `PslTypeReference` types in the SQL family (`psl-build/type-map.ts`, its export, `printer-config.ts`'s `typeMap`), and their tests (`postgres-type-map.test.ts`, the uses listed in inventory `type-constructors.md` section 5.2). `junction-relation-field-names.ts` builds its throwaway document without a type map. `EXISTING_COLUMN_DATE_TIME_TYPES` stays: the Prisma 7 type table reads it.

## Tests

- Infer unit tests over schema IR: each Postgres data type with a marked constructor, as a scalar and a list; parameters printed with the fewest arguments; pgvector and PostGIS columns with their packs in the context print `pgvector.Vector(3)` and `postgis.Geometry(...)`, and without them fail; `geometry(Point,4326)` fails even with PostGIS; several unclaimed columns across tables are all listed, sorted.
- The existing infer tests whose expected output changes because of item 2 are updated; list each such change in the report.
- Print tests pass unchanged.
