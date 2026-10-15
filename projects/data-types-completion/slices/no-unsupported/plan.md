# Slice plan: `contract infer` reads column types from data types, and `Unsupported(...)` leaves Prisma 8

Ticket TML-3582, branch `tml-3582-infer-reads-data-types`. Cut from slice 4 (TML-3387) on 2026-10-15 at Will's request, and built from `main` before the rest of slice 3. It does not depend on slice 3's value work.

## Outcome

```
$ prisma-next contract infer
✖ CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED
  contract infer: Prisma 8 cannot write these column types with the configured stack:
    public.place.location: geometry(Geometry,4326)
    public.doc.meta: hstore
  If a type comes from a database extension, add its pack to `extensions` in prisma.config.ts.
```

With `postgis` in the config's `extensions`, the same database infers `location postgis.Geometry(4326)`. `contract infer` never prints `Unsupported(...)`, and prints no schema when any column is unclaimed. `contract emit` on a Prisma 8 schema that says `Unsupported("hstore")` gives a message that names the type and says what to do, instead of the generic unknown-type message.

## What the code does today

- The SQL family already passes the configured stack to the target's infer hook: `pslBuildContext` holds the authoring contributions, the codec lookup and the data types, and the hook also gets the extension packs' contracts (`packages/2-sql/9-family/src/core/control-instance.ts`). Design 13.1 is done. Only the Postgres target's infer ignores `context.dataTypes` when it picks a column's type.
- Postgres infer picks types from three name tables in `postgres-type-map.ts` and falls back to `{ unsupported: true }`, which `infer-model-blocks.ts` prints as `Unsupported("...")`. `contract print` reads the same tables first, then falls back to the first constructor in the stack that reproduces the column.
- `resolveReportedSqlType` exists and is tested, but nothing calls it outside tests.
- Introspection stores a list column's element type in written form (`int4`, `timestamptz(3)`), through `normalizeSchemaNativeType`. Written texts are not claiming texts, so infer cannot resolve `nativeType` for a list column. It needs the catalog text.
- Only Postgres implements infer. SQLite has no infer hook, so SQLite is not part of this slice.
- PostGIS claims only `geometry` and `geometry(Geometry,<srid>)`. A column declared with a subtype, such as `geometry(Point,4326)`, has no claiming text, so infer will fail on it. Recognising subtypes needs a new parameter on `postgis/geometry`; it is not in this slice.
- The framework binder reports `Unsupported("x")` as an unresolved type, `PSL_UNRESOLVED_REFERENCE`, and lets a family describe the message through `describeUnresolvedType`.
- The CLI's `errorInitPrisma7ProviderUnsupported` is about a Prisma 7 datasource provider, not this type. It does not change.

## Scope

From design sections 11 to 13:

1. **11.1.** Postgres introspection hands each column a `ReportedSqlType` beside today's fields: the element's `format_type` text, `kind` from `typtype`, `nspname`, `typname`. For an extension type in another schema (Supabase installs `vector` in `extensions`), the leading `<schema>.` is removed. `nativeType` and verify do not change; slice 4 moves verify onto the resolver.
2. The resolver's placeholders accept a leading minus where the parameter schema allows a negative number, so `numeric(10,-2)` resolves (from `deferred.md`).
3. **13.5.** New Postgres constructors `Bit(length?)`, `VarBit(length?)`, `Interval(precision?)`, marked `inferred`. Without them, infer would fail on those columns instead of printing them.
4. **13.2, 13.3.** Infer resolves each non-enum column through `resolveReportedSqlType` over `context.dataTypes` and prints the constructor marked `inferred` for the data type, with the fewest arguments that give the same normalised parameters. Enum columns keep today's `pg.enum(Name)` path. A column with no claiming data type, or a data type with no marked constructor, goes into one `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED` error that lists every such column as `<schema>.<table>.<column>: <reported text>`.
5. **13.6, 13.7.** `contract print` picks the marked constructor of the column's data type instead of the name tables. `POSTGRES_TO_PSL`, `PRESERVED_NATIVE_TYPES`, `PARAMETERIZED_NATIVE_TYPES`, `INFERRED_PSL_TYPE_NAMES`, `createPostgresTypeMap`, the `PslTypeMap` types and the PSL printer's `isUnsupported` are deleted. The SQL family gives the binder a specific message for a field typed `Unsupported("x")`, keeping the code `PSL_UNRESOLVED_REFERENCE`.

Not in this slice:

- The Prisma 7 and Prisma 6 schema readers, their type tables, fixtures and docs (`packages/2-sql/2-authoring/contract-prisma7`, the Prisma 7 binding in the Postgres target, `contract-prisma6`). Anansi-36's project "Storage a model does not map" owns them. `EXISTING_COLUMN_DATE_TIME_TYPES` stays because the Prisma 7 type table reads it; slice 4 deletes it with 13.8.
- Verify's exact type comparison, schema IR `dataType` and `typeText`, the postcheck (section 12). These stay in slice 4.
- `normalizeFormattedType`, `normalizeSchemaNativeType`, `normalizeSqliteNativeType`: verify still reads them. Slice 4 deletes them.

## Output changes

Accepted by design 13.3 and 13.4:

- A column reported `numeric(10,0)` infers `Numeric(10)`, not `Numeric(10, 0)`. Similar for other types whose normal form fills in a default.
- Columns of `bit`, `varbit` and `interval` infer as `Bit`, `VarBit`, `Interval` instead of `Unsupported(...)`.
- A database with any unclaimed column type no longer infers a schema. Today it gets one that `contract emit` refuses.

`contract print` output must not change. A unit test already checks that each marked constructor is the name the type map writes; the print tests are the evidence.

No contract, hash or DDL changes. The golden planner manifest is not touched.

## Dispatches

| | What | Done when |
| --- | --- | --- |
| a | 11.1 `ReportedSqlType` from Postgres introspection, schema prefix removed; negative placeholders | Introspection tests over PGlite cover a base type, a list, an enum, a domain, and an extension type in another schema |
| b | `Bit`, `VarBit`, `Interval` constructors with documentation | Emit tests for each; the marked-constructor unit test covers them |
| c | Infer resolves through data types, prints marked constructors with fewest arguments, fails with `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED`; print uses marked constructors; the tables and `PslTypeMap` deleted | Infer and print unit tests; error reference entry |
| d | `Unsupported` removed from infer and the printer; the interpreter's specific message; tests of inventory 5.2 rewritten | The grep check below passes |
| e | Journeys and docs | See tests and docs below |

### Tests

- PGlite, for every Postgres data type with a marked constructor, as a single column and as a list: create the column through a planned migration, infer, and emit the inferred schema back to the same contract. `pg/tsquery` gets the failure test.
- A CLI journey with pgvector in PGlite: with the pack configured, infer prints `pgvector.Vector(3)`; without it, infer fails and names the column.
- PostGIS has no PGlite build: unit tests feed infer a schema IR with `geometry`, `geometry(Geometry,4326)` and `geometry(Point,4326)` columns (the last one fails), with and without the pack. Manual QA runs it against a real PostGIS.
- The failure lists every unclaimed column, not only the first.
- `contract emit` on `Unsupported("hstore")` shows the new message; the language server shows the same diagnostic.

### Docs

`docs/reference/error-reference.md` gains `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED`. The Postgres target README's infer paragraph, the SQL family README's `./psl-build` line, `scorecard/03-psl-schema-language.md`, and the "Declaring a data type" section of the codec authoring guide (the `inferred` mark, worded so it names no single reader, from `deferred.md`). `design.md` and `plan.md` move the items above out of slice 4.

### Grep checks

| Command | Allowed output |
| --- | --- |
| `git grep -nE '(^\|[^A-Za-z])Unsupported\(' -- packages test examples` | the Prisma 6 and Prisma 7 readers, their fixtures, tests and READMEs; `packages/3-extensions/postgres/README.md`; the interpreter's new message and its test |
| `git grep -n "POSTGRES_TO_PSL\|PRESERVED_NATIVE_TYPES\|PARAMETERIZED_NATIVE_TYPES\|INFERRED_PSL_TYPE_NAMES\|createPostgresTypeMap\|PslTypeMap\|isUnsupported" -- packages` | nothing |

## Halt conditions

- `contract print` output changes for any committed contract or print test.
- A committed contract changes, or the golden planner test finds a DDL change.
- A type reported by a real Postgres has a data type, but none of its claiming texts matches.
- The Supabase contract generation script (`packages/3-extensions/supabase/scripts/generate-contract.ts`) hits an unclaimed type.

## Effect on the other slices

Slice 4 keeps section 12, 13.8 and the deletion of `EXISTING_COLUMN_DATE_TIME_TYPES` and the normalisers. Slice 3's dispatch f, which changes how infer reads defaults, merges `main` after this slice and builds on the new infer path.
