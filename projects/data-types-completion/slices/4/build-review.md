# Slice 4 build review (TML-3387)

| Dispatch | Round | Commits | Must-fix | Should-fix | Low | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| a | 1 | `dc9e22ab28..e18a2f56eb` | 0 | 1 | 3 | ANOTHER ROUND NEEDED |
| a | 2 | `e18a2f56eb..bd7aad8b10` | 0 | 0 | 3 | SATISFIED |
| a | 3 | `cb6e833bed` | 0 | 0 | 0 | SATISFIED |
| b | 1 | `045561e038`, `f9b24e4a4f`, `d31df461b2` | 0 | 1 | 2 | ANOTHER ROUND NEEDED |
| b | 2 | `e2aac78778..8b54721858` | 0 | 0 | 0 | SATISFIED |
| c | 1 | `8b54721858..66c520ef88` | 0 | 1 | 2 | ANOTHER ROUND NEEDED |
| c | 2 | `3d48d80f40..93cd771cb7` | 0 | 1 | 2 | ANOTHER ROUND NEEDED |
| d | 1 | `f193c86c9a` | 0 | 0 | 3 | SATISFIED |
| c | 3 | `55dbe5ff17` | 0 | 0 | 0 | SATISFIED |
| d | 2 | `55dbe5ff17`, `5177521019` | 0 | 0 | 0 | SATISFIED |
| e | 1 | `4fd312cd43` | 0 | 0 | 0 | SATISFIED |
| f | 1 | `dad74de99b..bce7b3b5f9`, ADR 254 `ae9e5c08e8` | 0 | 0 | 3 | SATISFIED |
| branch review fixes | 1 | `3d35c66b22..50e6c2c3e4`, `77d85c5ab0`, ADR 254 `9e86f95876` | 0 | 0 | 0 | SATISFIED |

## Dispatch a, round 1

Every numbered item of the brief is built. The resolution runs inside the SQL family's `introspect`, so every caller of `familyInstance.introspect` gets it: `db verify` (`db-verify.ts` and `client.ts` schema verify), `db init` and `db update` (`db-run.ts`), both migration runners' post-apply checks, `db schema` and `contract infer`. No change outside the brief.

Checks run: `pnpm build`, root `typecheck:agent` (pass), tests of framework-components, sql-contract, schema-ir, sql family, Postgres and SQLite targets and adapters (all pass), `lint:deps` (pass), `lint:framework-vocabulary` (pass), the golden planner test (734 pass, no change), `fixtures:check` (clean), `git status` clean afterwards.

Verified without findings:

- Normal-form parameters change no hash or committed file. A value's `params` is read only by `dataTypeValuesEqual`; `toContract` writes the value alone. Spelling still uses the parameters as written, which is correct because parameters with one normal form give one spelling.
- Cost for `db schema` and `contract infer`: with the Postgres stack (52 SQL data types, 120 texts), 10,000 column resolutions take 157 ms, about 16 microseconds a column (`wip/s4/review-a1/bench.mjs`). Harmless. `contract infer` now resolves each column twice (its own `psl-build/column-types.ts` and the family); also harmless.
- The PGlite test covers an enum in `public` (`mood`) and in another schema (`app.status`), a list of an enum, a domain and a range (both unclaimed), and `numeric(10)` read as `{ precision: 10, scale: 0 }`.

### S4-a-R1-1 (should-fix): introspected nodes are rebuilt without their constructors

Where: `packages/2-sql/9-family/src/core/resolve-introspected-types.ts`, `rebuiltNode` and `rebuilt`.

What is wrong: the walk copies every changed container node with `Object.create(prototype, ownPropertyDescriptors)` and freezes the copy. I checked every schema IR class (the nine family classes and the six Postgres ones): each holds its state in own data properties, `kind` is an own non-enumerable property and is copied, none has a `#private` field, a cache or an own accessor, and nothing keys a `WeakMap` on a node. So the copies are correct today: `instanceof`, `nodeKind`, `children()`, `isEqualTo` and freezing all hold, and the PGlite test asserts the Postgres root. But the frozen-class pattern makes the constructor the one place a node is built, and this code is correct only while an unwritten rule holds. A target node with a `#private` field (the repository already uses one in `DataTypeValueRecord`) would throw a `TypeError` from its methods on the copy. A node that keeps columns in a `Map` or a non-node class would leave them unresolved with no error, and dispatch b would then report a false mismatch. A derived cache would be copied stale. `SqlColumnIR` meanwhile gets a constructor-based copy, `withDataType`, so the change uses two mechanisms.

Change: resolve each column when it is built. The control adapter is already created with the stack (`adapter.create(stack)` in `control-instance.ts`), so each adapter can pass a column's `reportedType` and `stack.declaredDataTypes` to one family function that returns `{ dataType, typeParams }` and put both in the column input. Delete the walk and `withDataType`. This adds one call in each adapter, which plan decision 1 ("no target code") may forbid; the orchestrator decides. If decision 1 stands as written, the sound alternative is a method on `SqlSchemaIRNode` that returns the node with its columns rebuilt, which each container class implements through its own constructor (two family classes, three Postgres classes), the rewriter variant of the frozen-class pattern.

### S4-a-R1-2 (low): `withDataType` copies fields by hand

Where: `packages/2-sql/1-core/schema-ir/src/ir/sql-column-ir.ts`, `withDataType`; its test in `sql-column-ir.test.ts`.

What is wrong: every field of `SqlColumnIRInput` is listed by hand, so a field added later is dropped silently. The test does not set `authoredDefault`, `codecRef` or `codecBaseNativeType`, so dropping them would pass.

Change: moot if S4-a-R1-1 resolves at construction. Otherwise set those three in the test.

### S4-a-R1-3 (low): the normal-form guard in `sqlDataType` is untested

Where: `packages/2-sql/1-core/contract/src/sql-data-type.ts`, the `normalize` passed to `dataType` (`isParamsOf(spec.params, params) ? normalize(params) : params`).

What is wrong: no test builds a value under parameters the type's schema refuses, so the branch that keeps them as written could be removed or inverted with every test green. `contract-to-schema-ir.ts` calls the unguarded `dataType.sql.normalize` directly, so the two callers treat bad parameters differently.

Change: add a test for a value built under parameters the schema refuses, or drop the guard if nothing can reach it.

### S4-a-R1-4 (low, for dispatch b): the contract side carries no stored type

Where: `packages/2-sql/9-family/src/core/migrations/contract-to-schema-ir.ts` `convertColumn`; `SqlColumnIR.isEqualTo`.

What is wrong: nothing is wrong in dispatch a, but b compares stored types and will need one. The contract-side column carries the codec's data type (`sqlite/datetime`) with parameters in that type's normal form; the database side carries the stored type (`sqlite/text`). `SqlColumnIR.isEqualTo` has no data type lookup, and the schema-ir package does not depend on sql-contract, so it cannot read `sql.storedAs`. `convertColumn` already computes the stored type (`const storage = sqlStorageType(dataType, ...)`, line 70).

Change: in dispatch b, stamp the stored type, with parameters in the stored type's normal form, on the contract-side column, and compare that. Alternatively, compare in the family, where the lookup is available.

Verdict: ANOTHER ROUND NEEDED, for S4-a-R1-1 once the orchestrator picks the approach.

## Dispatch a, round 2

Round 1 findings: S4-a-R1-1 is fixed as proposed. Each adapter calls the family's `resolveIntrospectedColumnType` while it builds a column, and the reflective rebuild is deleted. S4-a-R1-2 no longer applies, because `withDataType` is deleted. S4-a-R1-3 is fixed, with a test in `sql-data-type.declare.test.ts`. S4-a-R1-4 is done: `SqlColumnIR.storedType` exists, and `typeParams` holds the stored type's parameters in its normal form.

Checks run: `pnpm build`, root `pnpm typecheck` (pass). Tests of sql-contract, schema-ir, the SQL family, both targets, both adapters and Supabase (all pass). `lint:deps` and `lint:framework-vocabulary` (pass). The four integration test files the diff touches (8 files, 58 tests, pass). The golden planner test (734 tests, no change). Two SQLite e2e migration files that use the changed harness (13 tests, pass). `fixtures:check` (clean). `git status` was clean afterwards.

Every production construction of either control adapter gets the stack's data types. The two descriptors (`exports/control.ts`) pass `stack.declaredDataTypes`. Every caller builds through a descriptor's `create(stack)`: the CLI (`client.ts` `buildControlAdapter`, `migration-new.ts`), the family's `getControlAdapter` and the Supabase `generate-contract.ts` script. The e2e harness passes `sqliteDataTypes` from `@prisma/orm-sqlite/target/data-types`, a published export. The upgrade instructions that show the old constructors are for an earlier release and stay as they are.

`storedType` probes (`wip/s4/review-a1/stored-probe.mjs`, `pack-probe.mjs`, run against the built packages and `node:sqlite`):

- The contract side of `sqlite/datetime` and `sqlite/json` gives `sqlite/text` with `{}`, and DDL writes `text`. SQLite reports `TEXT`, which resolves to `sqlite/text`, stored as `sqlite/text`, `{}`. The two sides match.
- The pack type `pgvector/vector` gives the contract side `pgvector/vector` with `{ length: 3 }` (a codec-only key is dropped). The database side `vector(3)` gives the same id and parameters.

### S4-a-R2-1 (low): the normal-form guard in `sqlDataType` runs twice

Where: `packages/2-sql/1-core/contract/src/sql-data-type.ts`, `sqlDataType`.

What is wrong: `normalize` now checks the parameters against the schema itself, and the function handed to `dataType` wraps it in the same check again. Every value built runs the arktype check twice, and the outer branch can never be taken.

Change: hand `normalize` to `dataType` directly.

### S4-a-R2-2 (low): the runtime adapters resolve over the target's own types only

Where: `packages/3-targets/6-adapters/postgres/src/core/adapter.ts` and `.../sqlite/src/core/adapter.ts`.

What is wrong: each runtime adapter builds a control adapter with `postgresDataTypes` or `sqliteDataTypes`, not the stack's types. Today it only reads the marker, so nothing changes. If introspection were ever reached through it, a pack's columns would be unclaimed.

Change: none now. Keep it in mind if the runtime adapter ever introspects.

### S4-a-R2-3 (low): no introspection test asserts `storedType`

Where: `packages/3-targets/6-adapters/postgres/test/migrations/introspected-data-types.integration.test.ts`, `packages/3-targets/6-adapters/sqlite/test/migrations/introspected-data-types.test.ts`.

What is wrong: only the family unit test checks that an introspected column's `storedType` is its data type. Neither adapter's introspection test checks it, so an adapter could drop `storedType` with every test green. My probes above show the values are right today.

Change: add `storedType` to both tests' projections, here or in dispatch b.

Verdict: SATISFIED.

## Dispatch a, round 3

S4-a-R2-1 is fixed: `sqlDataType` hands its checked normal form to `dataType` once. S4-a-R2-3 is fixed: both adapters' introspection tests assert `storedType`. S4-a-R2-2 went further than the round 2 log asked. Both runtime adapters now build their control adapter with the stack's data types, and `createPostgresAdapterWithCodecRegistry` and `createSqliteAdapterWithCodecRegistry` take them as an argument. Neither function, nor either control adapter class, is in a published package's surface, so no upgrade instruction is needed. No test shows a pack's type reaching the runtime adapter, but that adapter only reads the marker, so I raise no finding. No new findings.

Verdict: SATISFIED.

## Dispatch b, round 1

Each numbered item of the brief is built. Every comparison site the brief lists now calls `sqlColumnTypesEqual`, and I found none it missed:

- `SqlColumnIR.isEqualTo`.
- Both issue planners, whose `columnTypeChanged` is deleted.
- SQLite `operations/tables.ts`.
- Both targets' `planner-strategies.ts`.
- Postgres `safe-widenings.ts`, which now reads `storedType`.
- Postgres `postgres-migration.ts`, through `writtenColumnType`.

`git grep` finds no remaining comparison of `nativeType` or `resolvedNativeType` between two columns. `pgIsTextLikeNativeType` in the Postgres adapter only renders DDL, which dispatch c covers.

Checks run:

- Build, typecheck and lint: `pnpm build`, root `pnpm typecheck` and per-package `pnpm lint` all pass.
- Package tests pass for framework-components, sql-contract, schema-ir, the SQL family, both targets, both adapters, pgvector and the CLI.
- `lint:deps` and `lint:framework-vocabulary` pass.
- The golden planner test and the two cross-package planner files pass: 780 tests, no DDL change.
- 16 CLI journey files pass: `cli.db-verify`, greenfield, drift-schema, native-enum-adoption, prisma7-source, data-type-defaults, brownfield-adoption, defaults-read-by-codec, autoincrement on SQLite, multi-step-migration, db-update-workflows, infer-roundtrip-fidelity, date-time-default-canonical-form, bytea-defaults, composite-pk-greenfield and rename-table-migration. That is 52 test files and 138 tests.
- `db verify` on committed examples: I built each example's database from its own migrations or contract on a fresh database (`wip/s4/review-b1/examples-verify.mjs`) and ran `db verify`. Four examples are clean: `prisma-8-demo` (Postgres with pgvector, through `db migrate`), `react-router-demo`, `prisma-8-cloudflare-worker` and `prisma-8-demo-sqlite` (each through `db init`). The local setup could not check four others, and none of these failures comes from the code under review:
  - `retail-store` is a Mongo project.
  - The local test server has no PostGIS, so `prisma-8-postgis-demo` could not be checked.
  - `supabase` and `paradedb-demo` stop with a contract-space layout error before reaching verify.

The implementer's decisions:

1. **The mismatch text leaves out the column.** This holds. The text reaches the user only through `issueLabel` in `cli/src/orm/db/verification.ts`, which prints `mismatch: <path>. <explanation>`. That covers `db verify` and `db sign` in human output, and the JSON diagnostic's `meta.issues` and `why`. `db update` and `migration plan` never print the text: their conflicts carry a location, and a type change becomes an `ALTER` operation.
2. **Default parsing takes the list flag.** This holds. `readPostgresDefault` read the type only for the `[]` suffix and the `box` check. The numeric check (`NUMBER_TYPE_PATTERN`) reads the cast inside the default expression, not the column's type. `box` has no data type in the stack, so a `box[]` column is never claimed, cannot be a contract column, and makes `contract infer` fail first. Removing the check loses nothing. SQLite still reads the declared text, which is correct, because SQLite derives a column's type affinity from that text.
3. **The copies that dropped fields are fixed.** The two `withColumnName` functions and the SQLite actual-schema rebuild are fixed. The rest of my sweep found no other copy that loses `storedType`. Every other table or schema rebuild passes existing `SqlColumnIR` instances through unchanged (`SqlTableIR`, `PostgresTableSchemaNode`, `infer-foreign-keys`, `padActualNamespaces`). The defect class is still open, though: see S4-b-R1-1.
4. **The test helper is copied.** See S4-b-R1-2.

### S4-b-R1-1 (should-fix): columns are copied by listing fields by hand, in two places

Where: `packages/3-targets/3-targets/postgres/src/core/migrations/working-schema.ts` and `packages/3-targets/3-targets/sqlite/src/core/migrations/working-schema.ts`, both `withColumnName`. Also the fallback in `packages/3-targets/3-targets/sqlite/src/core/migrations/diff-database-schema.ts` `withRecordKeyNames`, which spreads a `SqlColumnIR` instance whose name differs from its key, and so drops every non-enumerable field.

What is wrong: this dispatch had to fix both lists, because they had silently dropped the new fields. Any field added to `SqlColumnIRInput` later will be dropped the same way. A dropped `storedType` now produces a false type mismatch, and from that a planned `ALTER COLUMN TYPE`.

Change: add one `SqlColumnIR` method in schema-ir that returns the column under another name, copying every field. Use it at all three sites. Test it by checking that every own property of the copy, enumerable or not, equals the original's except `name`.

### S4-b-R1-2 (low): `introspectedColumn` is written three times

Where: `packages/2-sql/1-core/contract/test/introspected-column.ts`, `packages/3-targets/3-targets/postgres/test/postgres-type-lookups.ts` and `packages/3-targets/3-targets/sqlite/test/sqlite-test-types.ts`. The three function bodies are identical. Five other test files already wrap the first one by relative import.

Change: keep the one in `contract/test`, and make the two target helpers wrappers that only default `dataTypes`, as the five other files do. Where a column has a `reportedType`, the helper could call the production `resolveIntrospectedColumnType`, so the tests exercise the code the adapters run.

### S4-b-R1-3 (low): the `SqlColumnIR` class comment describes the old comparison

Where: `packages/2-sql/1-core/schema-ir/src/ir/sql-column-ir.ts`, the class doc comment. It still says equality uses `resolvedNativeType` and falls back to raw fields.

Change: say that `isEqualTo` compares the type with `sqlColumnTypesEqual` and compares nullability.

Verdict: ANOTHER ROUND NEEDED, for S4-b-R1-1.

## Dispatch b, round 2

S4-b-R1-1 is fixed. `SqlColumnIR.withName` copies every own property of the column and rebuilds it through the constructor. Its test compares the own property descriptors of the copy and the original, enumerable or not, apart from `name`, so it fails if a field is dropped. Both `withColumnName` functions are gone, and the SQLite `withRecordKeyNames` uses `withName` for an instance whose name differs from its key. S4-b-R1-2 is fixed: the two target helpers wrap the shared `introspectedColumn`. Widening the targets' typecheck `rootDir` to `../../..` matches the adapters, and it only affects typechecking: the build uses tsdown and `tsconfig.prod.json`. S4-b-R1-3 is fixed. No new findings.

Verdict: SATISFIED.

## Dispatch c, round 1

Each numbered item of the brief is built:

- `typeText` replaces `nativeType`.
- `resolvedNativeType`, `codecBaseNativeType` and the type-name normalisers are deleted.
- `introspectedNativeType` is now `introspectedTypeText`.
- The DDL builders that take a schema IR column write the type from `storedType`.
- `CatalogColumnType.dataType` is now `informationSchemaType`.
- `TypeLookups` in framework-components replaces `SqlTypeLookups`, `MongoTypeLookups`, contract-ts's local pair and the loose fields in `data-type-default.ts`.

Checks run:

- `pnpm build`, root `pnpm typecheck`, `lint:deps` and `lint:framework-vocabulary` pass.
- Package tests pass for framework-components, mongo-contract, sql-contract, schema-ir, contract-psl, contract-ts, the SQL family, both targets, both adapters, pgvector, postgis, the CLI and publish-surface.
- The golden planner test passes (734 tests, run without the write flag, so nothing was re-recorded). It still records `numeric(10)` and `character varying(255)`.
- The integration files and journeys the diff touches pass (42 files, 178 tests): `cli.db-introspect`, `family.introspect`, `db-schema-discovery`, the enum-members tests, the cross-package planners, greenfield, drift-schema, data-type-defaults, infer-roundtrip-fidelity, multi-step-migration and `cli.db-verify`.
- The SQLite e2e `destructive` test passes.
- `check:upgrade-coverage --mode pr` passes, and so do `check:publish-deps` and `lint-publishability`.

PGlite round trip: I ran a temporary test in the Postgres adapter, deleted afterwards. A contract with `numeric(10)`, `varchar(20)`, `timestamptz(3)`, a bare `char` and `text[]` was planned and applied, then verified. The database reports `numeric(10,0)`, `character varying(20)`, `timestamp(3) with time zone`, `character(1)` and `text[]`, and `db verify` reports no issues. Writing DDL from the stored type with the parameters as written keeps the planned DDL unchanged, and the comparison through data types matches it to what the database reports.

The `db schema` JSON output: its `schema` field is the introspected schema IR serialized as it is, typed `unknown` in `SchemaDocument`. The CLI README and `skills/prisma-8/references/migrations.md` document that `--json` exists and suggest `jq` over it, but nothing documents its fields: no output schema, published type or reference page names `nativeType`. The rename also removes `resolvedNativeType` from that output. I recommend keeping the new key. Keeping the old one would need a custom serializer that only exists for compatibility, and the repository does not keep compatibility shims. Mention the rename in the app upgrade note of S4-c-R1-1, because the skill tells agents to read this JSON. The tree output now prints the reported type (`integer` where it printed `int4`), which is a display change only.

The grep rows: the first row 4 grep returns only `buildExpectedFormatType` (and its tests and export), owed by dispatch d, and `EXISTING_COLUMN_DATE_TIME_TYPES`, owed by dispatch e. The `nativeType` allowances are justified:

- The Prisma 7 type table's `nativeTypes` key, keyed by `@db.*` names.
- The Mongo Prisma 6 `nativeTypeCodecIds`, also keyed by `@db.*` names.
- The old-contract refusal in `validators.ts`, with its tests and the Supabase fixture.
- The `data-type-in-contract` upgrade tests and their fixtures.
- The comments in the pgvector and postgis `migration.ts` files.

`AuthoringTypeLookups` was never exported, so replacing it loses nothing.

### S4-c-R1-1 (should-fix): published names are removed without an upgrade note

Where: these entry points are re-exported unchanged by the published packages.

- `SqlTypeLookups`, removed from `@internal/sql-contract/data-type`, which `@prisma/orm-family-sql`, `@prisma/orm-postgres` and `@prisma/orm-sqlite` publish.
- `MongoTypeLookups`, removed from `@internal/mongo-contract/data-type`, which `@prisma/orm-family-mongo` and `@prisma/orm-mongo` publish. The published rc.14 to rc.15 extension guide tells extension authors to type a parameter with it.
- `normalizeSchemaNativeType`, `introspectedNativeType` and `IntrospectedNativeType`, removed from `@prisma/orm-postgres/target/native-type-normalizer`, and `CatalogColumnType.dataType`, renamed there.
- `normalizeSchemaNativeType` and `normalizeSqliteNativeType`, removed from the adapters' control entry points.
- `SqlColumnIR` and `SqlColumnIRInput`: `nativeType` renamed to `typeText`, `resolvedNativeType` and `codecBaseNativeType` removed. These are published through `@prisma/orm-family-sql/schema-ir`.
- From dispatch b, on the same entry points: `DefaultResolver` now takes a column, and `readPostgresDefault` takes a list flag.

`check:upgrade-coverage` does not catch these, because it only requires a declaration for changes under `examples/` and `packages/3-extensions/`. The repository has documented changes like these for extension authors before.

Change: add an extension fragment under `upgrade-instructions/pending/`. For each removed or renamed name, say what replaces it: `TypeLookups` from the framework's `codec` entry point, `typeText`, `storedType` and `typeParams`, and `informationSchemaType`. Add an app fragment line for the `db schema --json` column key. The orchestrator writes these.

### S4-c-R1-2 (low): the rename reached prose where it no longer makes sense

Where:

- `packages/3-targets/6-adapters/postgres/src/core/control-adapter.ts:262`, which says "`::typeText` cast suffixes".
- Two test names in `packages/3-targets/6-adapters/postgres/test/lower-to-execute-request.test.ts` ("::typeText cast").
- The doc comment of `packages/3-targets/6-adapters/postgres/test/migrations/planner.uuid.integration.test.ts`, which says removing "`typeText: 'uuid'`" from "the storage descriptor" changes the DDL. No storage descriptor carries such a field.
- `packages/2-sql/1-core/schema-ir/README.md`, whose "Native type primary" paragraph still says verification centres on the type text.

Change: write what each means now. The cast suffix is the type's SQL name, the uuid test depends on the codec's data type, and the README should say columns compare by their stored data type and parameters.

### S4-c-R1-3 (low): one grep allowance misses a file

Where: `projects/data-types-completion/plan.md`, the slice 4 row for `Unsupported(`. Its output includes `packages/2-sql/2-authoring/contract-psl/test/interpreter.field-type-resolution.test.ts`, which tests the TML-3582 message, but the allowance names only `native-type-parity.test.ts` and `sql-unsupported-type-lsp.integration.test.ts` as its tests.

Change: add that file to the allowance.

Verdict: ANOTHER ROUND NEEDED, for S4-c-R1-1.

## Dispatch c, round 2

S4-c-R1-2 and S4-c-R1-3 are fixed: the prose now says what each thing means, and the `Unsupported(` allowance names the contract-psl interpreter test. S4-c-R1-1 is answered by `upgrade-instructions/pending/column-types-through-data-types/`. Its detection test passes (30 tests), and `check:upgrade-coverage` passes in both `pr` and `dev` mode. I read the fragment as an extension author who has not seen this project. Most changes say what to do, with a before-and-after example. Three do not, or say it wrongly.

### S4-c-R2-1 (should-fix): one change gives the wrong field name

Where: `extension/instructions.md`, `default-resolver-takes-the-column`. The summary says a `DefaultResolver` receives `{ nativeType, many }`. `DefaultResolverColumn` in `contract-to-schema-ir.ts` has `typeText` and `many`.

Change: write `{ typeText, many }`.

### S4-c-R2-2 (low): several changes name an entry point without its import path

Where: `type-name-normalisers-removed`, `introspected-type-text`, `alter-type-postcheck-by-data-type` and the `renderSqlTypeName` sentence in `schema-ir-column-type-text`. They say "the Postgres target's `native-type-normalizer` entry point", "the Postgres adapter `control` entry point" and "the SQL contract's `data-type` entry point". Only `type-lookups-one-framework-type` and `schema-ir-column-type-text` give a path an author can import.

Change: write the published paths: `@prisma/orm-postgres/target/native-type-normalizer`, `@prisma/orm-postgres/adapter/control` (and the SQLite one), `@prisma/orm-postgres/target/planner-sql-checks` and `@prisma/orm-family-sql/contract/data-type`.

### S4-c-R2-3 (low): it does not say that a column built by hand now needs its type

Where: `schema-ir-column-type-text`. Its example builds `new SqlColumnIR({ name: 'id', typeText: 'int4', nullable: false })`. That column has no `storedType`, so after this slice it never compares equal to any column. An extension test that builds expected and actual columns by hand (this repository's own tests needed the `introspectedColumn` helper for exactly that) would start reporting mismatches.

Change: say that a column built by hand compares equal only when it has `dataType`, `storedType` and `typeParams`, and show them in the example.

Verdict: ANOTHER ROUND NEEDED, for S4-c-R2-1.

## Dispatch d, round 1

Each numbered item of the brief is built:

- `alterTypeCheck` returns a `ColumnTypeCheck`: `catalog-text` (the `renderSqlCatalogText` of the one data type that reads the written type, plus `[]` for a list) or, for a type that claims a kind, `identity` (`to_regtype` of the name the data type renders, or that type's `typarray` for a list).
- `buildExpectedFormatType`, `alterTypeCheckText`, `catalogTypeTextIfReadable`, `quoteIdentifierWhereNeeded` and `POSTGRES_QUOTED_KEYWORDS` are deleted. Nothing else used them, and none of them was in a published entry point other than `planner-sql-checks`.
- The first row 4 grep now returns only `EXISTING_COLUMN_DATE_TIME_TYPES`, which dispatch e owes.

Checks run:

- `pnpm build`, root `pnpm typecheck`, `lint:deps` and `lint:framework-vocabulary` pass.
- Tests of the Postgres target, the Postgres adapter, pgvector and postgis pass.
- The new PGlite test passes (4 tests): every written type of every Postgres data type as a column and a list, the enums, and an enum of the same name in another schema, which fails as it should. It checks that the postcheck fails before the change and passes after it.
- The golden planner test and the cross-package planner files pass (831 tests). The recordings do not change.
- The `postgres-postchecks-check-full-definition` upgrade test passes.

My own probes:

- The PGlite test covers every Postgres data type, but no pack type. I ran a temporary test, deleted afterwards, with a data type shaped like pgvector's (`vector({length})`) on a database with the `vector` extension. For `int4` to `vector(3)`, `vector(2)` to `vector(3)` (a change of parameter only) and `int4[]` to `vector(3)[]`, the postcheck fails before the change and passes after.
- With pgvector, no written text of any Postgres type is read by more than one data type. So the new refusal when two data types read the same text, which used to pass when both printed the same catalog text, cannot trigger with the shipped stack.

Published names on `target/planner-sql-checks`: only `buildExpectedFormatType` and `alterTypeCheckText` were removed, and the fragment covers both. `alterTypeCheck` and `ColumnTypeCheck` were added, and `qualifyTableName` and `stackDataTypes` stay.

The enum postcheck description now names the rendered name, so it reads `verify column "c" has type ""app"."status""`. It is understandable, but the quotes double up (S4-d-R1-2). Postcheck descriptions are written into `ops.json`, so a migration emitted again from its `migration.ts` gets new enum postcheck text and SQL, and with them a new migration hash. That is expected for a changed check, and the migrations already committed keep the check they recorded. None of the examples' committed migrations alters a column to an enum.

### S4-d-R1-1 (low): the fragment does not mention `checkType`

Where: `AddColumnCall`, `AlterColumnTypeCall`, `AddRequiredColumnToEmptyTableCall` and `AddColumnWithTemporaryDefaultCall`, published through `@prisma/orm-postgres/target/op-factory-call`. Their public `checkType` field changed from a string to a `ColumnTypeCheck`.

Change: add a sentence to `alter-type-postcheck-by-data-type`.

### S4-d-R1-2 (low): the enum postcheck description doubles its quotes

Where: `columnTypeStep` and `alterColumnType` in `packages/3-targets/3-targets/postgres/src/core/migrations/operations/columns.ts`, which wrap `columnTypeCheckText(check)` in double quotes.

Change: for an `identity` check, write the rendered name without the extra quotes, as in `verify column "c" has type "app"."status"`. Otherwise keep it as it is: it is display text only.

### S4-d-R1-3 (low): the PGlite test has no pack type

Where: `packages/3-targets/6-adapters/postgres/test/migrations/alter-column-type-postcheck.integration.test.ts`.

Change: add a case with a pack-shaped data type declared in the test, as my probe did, so the catalog-text check is covered for a type outside the target's own list.

Verdict: SATISFIED.

## Dispatch c, round 3

S4-c-R2-1 is fixed: `DefaultResolver` now says `{ typeText, many }`. S4-c-R2-2 is fixed: every change names a published path. I checked each path against the public packages' `package.json` exports, and `pgInt4` in the example is exported from `@prisma/orm-postgres/target/data-types`. S4-c-R2-3 is fixed: the summary and the section say that a column built by hand needs `dataType`, `storedType` and `typeParams`, and the example sets them. The detection test still passes (30 tests). No new findings.

Verdict: SATISFIED.

## Dispatch d, round 2

S4-d-R1-1 is fixed: the fragment says that `call.checkType` is now a `ColumnTypeCheck` and how to read it. S4-d-R1-2 is fixed: `columnTypeCheckText` puts catalog text in double quotes and writes an enum's quoted name as it is, so an enum postcheck reads `verify column "c" has type "app"."status"`. Catalog-text descriptions are unchanged, so no recorded postcheck description moves. S4-d-R1-3 is fixed: the PGlite test declares a pack-shaped `vector({length})` type and changes `int4` to `vector(3)`, `vector(2)` to `vector(3)` and `int4[]` to `vector(3)[]`. Each postcheck fails before the change and holds after it. The file passes (5 tests). No new findings.

Verdict: SATISFIED.

## Dispatch e, round 1

The brief is built as amended. `prisma7PostgresTypes` names a data type and parameters for each Prisma 7 scalar and `@db.*` type. `prisma7PostgresTypeMap` is computed from it: for each entry, the constructor marked `inferred` for that data type, with every parameter as an argument, through `authoringTypeConstructorArguments`. `EXISTING_COLUMN_DATE_TIME_TYPES` and its file are deleted. The first row 4 grep now returns nothing.

- **The computed table matches the old one entry for entry.** The new test asserts the whole computed table as a literal. I compared that literal with the deleted table: all 9 scalars and 20 native types have the same constructor name and the same arguments, including `Numeric('65','30')`, `TimestampString('3')`, `Char('1')` and the four date and time string constructors.
- **The deleted `type-constructors` test loses nothing.** It checked that each `EXISTING_COLUMN_DATE_TIME_TYPES` name is a constructor marked `inferred`. Now every entry's constructor is found through the marked constructors, so a date and time entry cannot name an unmarked one. The table test pins the resulting names.
- **No Prisma 7 output moved.** The `contract-prisma7` tests pass against their committed expected contracts. The `prisma7-source`, `prisma7-migration-ledger` and `infer-roundtrip-fidelity.prisma7-defaults` journeys and the golden planner test pass (10 files, 758 tests). `fixtures:check` is clean, and `git status` is clean afterwards.

The table is computed when the module loads. Only `prisma7-binding` imports it, and only the Prisma 7 config entry point loads that, so the cost is paid only when a project reads a Prisma 7 schema. An unmarked constructor would throw an `InternalError` at load, which the table test would catch first.

Checks run: `pnpm build`, root `pnpm typecheck`, `lint:deps` and `lint:framework-vocabulary` pass. Tests pass for the Postgres target, `contract-prisma7`, the Postgres adapter and the Postgres extension.

Verdict: SATISFIED.

## Dispatch f, round 1

Each numbered item of the brief is built:

- The test-only extension `testext` and its journey.
- A matrix on each target: Postgres in `marked-types-round-trip`, SQLite in `data-type-verify`, which covers all 8 SQLite data types.
- The enum cases.
- The golden test and `manifest.json` are deleted.
- The DoD rule that required re-recording the golden test is removed, the failure mode that described the golden test is marked retired, and the SQL family README is updated.

ADR 254 is the orchestrator's edit, reviewed below.

Checks run:

- `pnpm build`, root `pnpm typecheck`, `pnpm lint`, `lint:deps`, `lint:docs`, `lint:framework-vocabulary`, `check:error-reference`, `fixtures:check` and `check:upgrade-coverage --mode pr` pass.
- The extension journey passes (4 tests). The Postgres matrix file passes (6 tests). `verify-through-data-types` passes (6 tests), and so does the SQLite `data-type-verify` (6 tests).
- The slice 4 grep checks return only what they allow, apart from S4-f-R1-3.
- `pnpm test --coverage` passes in 18 of the 20 packages the slice touched. Two fail on timing alone, not on a coverage threshold, and neither failure comes from this slice:
  - `packages/3-extensions/postgres`: `define-config.glob-e2e.test.ts` takes 545 ms against a 500 ms limit.
  - `packages/1-framework/3-tooling/language-server`: up to three tests in `server.membership-races.test.ts` take 511 to 555 ms. They failed again when I reran them. The slice changed one line of an unrelated test file in that package.

The reviewed points:

- **The extension journey is a fair test.** `git grep` finds no production code in the framework, the SQL family or the targets that names `vector`. The type is claimed only through `testext`'s declared text `vector({size})`, and pgvector is not in the config. PGlite cannot create a base type, and a domain reports the kind `domain`, which no data type claims by text, so borrowing the base type an installed extension provides is the only way to get a base-type text on PGlite. Without `testext`, the journey shows verify naming `vector(3)` and `vector(3)[]`, and infer failing with `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED`.
- **Dropping the CHECK constraints hides no mismatch.** The constraints are dropped only so that `ALTER COLUMN TYPE` can run, and the matrix then compares column-level issues only. The verify before the drop also filters to column issues, though, so on its own it does not prove the whole verify is clean. I temporarily changed the test to assert the full issue list before the drop, then restored it: no issues at all. See S4-f-R1-2.
- **The golden test's retirement.** What stays:
  - Both fixture directories, with `contract.ts`, `prisma.config.ts`, `generated/` and `planned.golden.json`.
  - The fixture root in `test/integration/scripts/emit-fixture-configs.mjs`. The `integration-tests` emit that `fixtures:emit` runs uses that root, so `fixtures:check` still re-emits and diffs the kept contracts. It is clean.
  - The `biome.jsonc` ignore for `planned.golden.json`. The ignore for `manifest.json` is removed.
  The contract-parity tests, `every-postgres-contract-roundtrip` and the two `postchecks-check-full-definition` upgrade detection tests still reference these fixtures.
- **The coverage timeout is not this branch's doing.** I built `bot/main` (`da82c8c864`) in a temporary worktree under `wip/`, removed afterwards, and ran the postgres extension package under coverage three times. The glob test took 469 ms, 540 ms (failed) and 504 ms. On this branch it took 386, 470, 482 and 545 ms. So it times out on `bot/main` too, and CI's coverage job is no more at risk from this branch. The language-server race tests sit at the same 500 ms limit.
- **ADR 254 (`ae9e5c08e8`) matches the code.**
  - The new "Comparing column types" bullet matches `sqlColumnTypesEqual`: the stored data type, normal-form parameters and list flag. It matches how an enum's name is read from the catalog's schema and name, the unclaimed-type message word for word, and the postcheck (`format_type` against the catalog text, or identity through `to_regtype` and `typarray`). It also states the unbound-namespace limit.
  - The rewritten "Stored as" bullet is right: introspection resolves to a storage type, because a type stored as another declares no texts or kind, and the contract side compares its `storedType`.
  - The `contract infer` paragraph matches `psl-build/column-types.ts` (`fewestArgumentsCall`, `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED` listing every column).
  - No sentence in the ADR still describes comparing type names.

### S4-f-R1-1 (low): the enum mismatch text writes the two sides differently

Where: `typeTextOf` and `reportedTextOf` in `packages/2-sql/1-core/schema-ir/src/ir/sql-column-ir.ts`. The contract side prints its written name (`mood[]`). The database side prints `schema.name` from the catalog (`public.Order Status[]`).

Change: write both sides the way the contract writes an enum's `typeName`, which is the rule `pg/enum`'s `fromReported` already uses. The name is bare in `public` and `schema.name` otherwise, with `[]` for a list. The example then reads `The contract column is "mood[]" and the database column is "Order Status[]"`. This keeps the database side independent of the search path. The simplest way is to have introspection give an enum column's type text in that form, so `explainMismatch` no longer needs its kind branch.

### S4-f-R1-2 (low): the Postgres matrix's clean verify checks columns only

Where: `test/integration/test/psl-infer/marked-types-round-trip.integration.test.ts`, the first `notEqualColumns()` call, before the CHECK constraints are dropped.

Change: assert there that the whole issue list is empty, as my temporary change did. It passes today. Keep the column-only filter for the rest of the test.

### S4-f-R1-3 (low): one grep allowance misses a file

Where: `projects/data-types-completion/plan.md`, the slice 4 `nativeType` row. Its output includes `test/integration/test/upgrade-instructions/column-types-through-data-types/detection.test.ts`, which this slice added, but the allowance names only the earlier upgrade script's tests.

Change: add this slice's upgrade detection test to the allowance.

Verdict: SATISFIED.

## Branch review fixes, round 1

The rulings are in `slices/4/briefs/review-fixes.md` and the findings in `slices/4/reviews/`. Each item closes its finding as ruled:

- **D01** (`58decfab13`): `SqlColumnIR.dataType` is deleted. The `.dataType` reads that remain in production are of contract `StorageColumn`s (a string id), not of schema IR columns.
- **D02** (`f862b52584`): the normal-form parameters are `storedTypeParams`, and their doc says DDL writes the parameters as written, from `codecRef`.
- **D03** (`1cd432bb93`): `isSafeTypeWidening` takes two `SqlColumnType`s and reads `storedType` and `storedTypeParams` on both sides. `columnType`, `introspectedColumnType` and the `InternalError` are deleted. See the note below.
- **D04** (`e3f473064f`): `sameSqlColumnType` in sql-contract compares the stored type id, parameters in normal form, and list-ness. It is used by the many-to-many check and by the field-event planner, which separately compares the parameters the codec keeps for itself. See the note below.
- **D05** (`41ac47142a`): `typeText` says what it holds on each side and who reads it: display, the `resolveDefault` hook, and SQLite's default reader. It also says nothing compares it. DDL no longer reads it since dispatch c, so leaving DDL out is correct.
- **D08** (`ae17c7b4ea`): `ResolvedSqlType.dataType` is the `SqlDataType`. The second lookups are gone, and `e32708f503` adds the upgrade text.
- **F03** (`1c38fc5324`): `shownTypeOf` does not wrap text that already contains double quotes (`"char"`), and an empty SQLite declared type reads `The database column has no declared type, which no data type in the configured stack declares.` Both are tested.
- **F04** (`8f325d46ea`): see the note below.
- **F01** (`749566698f`): both control adapter constructors have before-and-after samples at the published paths, with the advice to pass the stack's declared types when it has extensions.
- **F02** (`50e6c2c3e4`): the app text says what `typeText` holds: the `format_type` text, lower-cased on SQLite, an enum named as a contract names it, and a type off the search path keeping its schema. It also covers `CONTRACT.DEFAULT_INVALID`'s `meta.typeText`.
- **The fixes for my own findings:**
  - `ba0083be2c` names an enum column as a contract does, so a mismatch writes both sides alike (S4-f-R1-1).
  - `f314203434` makes the matrix assert no issue at all before it changes any column (S4-f-R1-2).
  - `3d35c66b22` updates the grep allowance (S4-f-R1-3).
- **D06, D07, D09 and D10** (`77d85c5ab0`): D06 is recorded in `deferred.md`. D07 is not taken, as ruled. The ADR comparison paragraph now sits beside storage types. The plan's dispatch e row says "every parameter the entry names".

**D03's behaviour change is right, and a PGlite test cannot reach it.** `typeChangeCallStrategy` runs only when there is a `fromContract` and a `convert` statement names the column. `migration plan` builds the start schema from the previous contract, so its columns always carry a stored type. `db update` refuses `convert` and `backfill` statements before planning (`errorStatementNeedsMigrationFile` in `cli/src/orm/db/update.ts`). So no CLI path brings an introspected column to this strategy. The old `InternalError` was reachable only from a hand-built unit test, and that test now shows the safe widening altered in place, as a contract column always was. One rule for both kinds of column is the right outcome. A PGlite test would need a path that does not exist.

**D04's list check is a new refusal, but no committed contract hits it.** `fixtures:check` re-emits and validates every committed contract and is clean, and the sql-contract validator tests pass. A junction column that is a list, paired with a scalar model column, would make the join compare an array with an element, so refusing it is correct. The field-event planner now also counts a change of list-ness as an altered column, which it did not compare before. That is a correction.

**The F04 tests plan nothing for the right reason.** Every column is claimed: the PGlite test introspects `extensions.vector(3)` under pgvector and `app.status` off the search path, and an unclaimed column would show up as a verify issue. To check the test can fail, I temporarily changed the contract's `varchar(20)` to `varchar(30)` and `numeric(10)` to `numeric(11)`, then restored it. Verify then named both columns and the planner planned `alterType.t.amount` and `alterType.t.name`. The SQLite test plans nothing for the same reason. Its `json`, `datetime` and `bigint` columns are declared as `text`, `TEXT` and `Integer`, and resolve to the stored types those contract types have.

**ADR 254 after `9e86f95876` matches the code.**

- The paragraph's new sentence, that the rule is the same for two contracts in the migration planner and the many-to-many check, matches `sameSqlColumnType`.
- "Without the stack's data types, the validator compares parameters as written" matches its fallback when the lookup does not know the data type.
- The SQLite message for an empty declared type matches `explainMismatch` word for word.

Checks run:

- `pnpm build`, root `pnpm typecheck`, `lint:deps`, `lint:framework-vocabulary`, `lint:docs`, `fixtures:check` and `check:upgrade-coverage --mode pr --prev 90959561c4` pass.
- Package tests pass for framework-components, sql-contract, schema-ir, the SQL family, both targets, both adapters, pgvector, contract-psl and the CLI. In the CLI package, one `migration-plan.test.ts` test hit its 500 ms limit on the first run and passed on rerun (48 tests). The timed-out run left a gitignored temporary directory, which I deleted.
- The new other-spellings test, the upgrade detection test, the marked-types matrix and the extension journey pass (8 files, 52 tests).
- The slice 4 grep checks return only what they allow.

Verdict: SATISFIED.
