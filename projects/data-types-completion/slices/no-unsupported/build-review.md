# TML-3582 build review

## Scoreboard

| Dispatch | Round | Commits | Must-fix | Should-fix | Low | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| a | 1 | `67963d5f75..5a0499d5d4` | 0 | 1 | 1 | ANOTHER ROUND NEEDED |
| a | 2 | `62c15aa65e`, design `72b6bf7d91` | 0 | 0 | 0 | SATISFIED |
| b | 1 | `28bca080c5` | 1 | 0 | 1 | ANOTHER ROUND NEEDED |
| b | 2 | `aa25910d4b` | 0 | 0 | 0 | SATISFIED |
| c | 1 | `4ac4243a16`, `53096c9043` | 1 | 0 | 1 | ANOTHER ROUND NEEDED |
| c | 2 | `d07a038ff3`, `63c91e5a78` | 0 | 0 | 0 | SATISFIED |
| d | 1 | `3d23ff83e0`, `d2e3fa83ee`, `8784270c6d` | 0 | 0 | 1 | SATISFIED |
| e | 1 | `beb6044cde`, `d7c37b3e58` | 0 | 0 | 2 | SATISFIED |
| branch review fixes | 1 | `431ce95d00..f94a25317b` | 0 | 1 | 0 | ANOTHER ROUND NEEDED |

## Findings log

### Dispatch a, round 1

Checks run: root `pnpm typecheck:agent` passed. `pnpm test` passed in framework-components, sql-contract, sql-schema-ir, pgvector, postgis, target-postgres and adapter-sqlite. adapter-postgres had 5 hook timeouts under machine load in three migration files unrelated to the diff; those files and the two new test files pass when run alone. `pnpm lint:deps`, `pnpm lint:framework-vocabulary` and `pnpm lint` in every touched package passed. No committed `contract.json`, `contract.d.ts` or golden planner file changed.

The implementer's two choices are accepted:

- `reportedType` as a non-enumerable optional field. Infer receives the introspected schema in memory in every caller: the CLI (`client.introspect` then `client.inferPslContract`, no serialisation), the family instance and the Supabase generation script. Every reconstruction on the way keeps the column instances: `PostgresTableSchemaNode` and `SqlTableIR` reuse an existing `SqlColumnIR`, `infer-psl-contract.ts` passes the table to `new SqlTableIR(table)`, and `resolveForeignKeys` spreads the table, not its columns. No code in the Postgres adapter, the Postgres target, schema IR or the SQL family spreads a column. Dispatch c can read `column.reportedType` wherever infer reads `column.nativeType`.
- `ReportedSqlType` in `@internal/sql-schema-ir/types`. `sql-contract` already depends on `sql-schema-ir`, and the column type needs it, so this is the only direction that works.

Verified against PGlite (`format_type` of the element, `typtype`, `typcategory`, `typelem` for each case): the integration test's texts match what the database returns, and a domain over an array has `typelem = 0`, so it reads as a domain.

#### U-a-R1-1 (should-fix): `int2vector` and `oidvector` columns report their element type

- Where: `packages/3-targets/6-adapters/postgres/src/core/control-adapter.ts`, the column query's `LEFT JOIN pg_catalog.pg_type et ON t.typcategory = 'A' AND t.typelem <> 0 AND et.oid = t.typelem`.
- What is wrong: `int2vector` and `oidvector` have `typcategory = 'A'` and a non-zero `typelem`, but `format_type` prints them without `[]`, so `many` is false. PGlite reports `reportedType.text` `smallint` and `oid` for them. Dispatch c would then infer a scalar `smallint` column for an `int2vector` column instead of failing with the unclaimed-type error. Design 11.1 states the `typcategory` rule, so the implementer followed it; the rule is wrong for these two types.
- Change: join on `et.typarray = t.oid`. In PGlite this matches exactly the columns whose `format_type` ends in `[]` (checked for `int2vector`, `oidvector`, `point`, `name`, a domain over `integer[]`, `positive[]`, `mood[]`, `bit(3)[]`, `varchar(5)[][]`). Add an `int2vector` column to the integration test, expecting text `int2vector` and `many` false. The orchestrator updates the array rule in design 11.1.

#### U-a-R1-2 (low): design names the old home of `ReportedSqlType`

- Where: `projects/data-types-completion/design.md`, the export list near line 54, which lists `ReportedSqlType` under `sql-contract`'s `./data-type`.
- What is wrong: the type now lives in `@internal/sql-schema-ir/types`.
- Change: the orchestrator updates the design's export list.

### Dispatch a, round 2

U-a-R1-1 is closed. The element type is now joined on `et.typarray = t.oid`, and the integration test has an `int2vector` column that expects text `int2vector` with `many` false. The reported-type integration test and the `reportedSqlType` unit test pass. U-a-R1-2 is closed: design 11.1 states the `typarray` rule and the export list names `@internal/sql-schema-ir/types` as the home of `ReportedSqlType`.

### Dispatch b, round 1

Checks run: root `pnpm typecheck:agent` passed. `pnpm test` passed in target-postgres. In the Postgres extension package one test in `define-config.glob-e2e.test.ts` timed out at 500 ms under load and passed alone. The adapter's `bit-interval-columns` integration test passed. `pnpm lint` in the three touched packages, `pnpm lint:deps` and `pnpm fixtures:check` passed, and `fixtures:check` left the tree clean, so no committed contract changes. `test/psl-print/every-postgres-contract-roundtrip.integration.test.ts` fails (U-b-R1-1).

The constructors match design 13.5 and the brief: names, codecs, optional argument mapped to the parameter of the same name, `inferred: true`, and documentation in the neighbours' form. The emit tests cover each spelling as a scalar and as a list. PGlite reports a bare `Bit` as `bit(1)`, and `pg/bit` normalises a missing length to 1, so dispatch c's fewest-arguments rule will print it back as `Bit`.

`NOT_YET_WRITTEN_BY_INFER` in `type-constructors.test.ts` is acceptable for one dispatch. Without it the marked-constructor test would fail, because the name tables infer reads today do not cover the three new types. Dispatch c deletes `INFERRED_PSL_TYPE_NAMES`; its review checks that this constant goes with it.

#### U-b-R1-1 (must-fix): the print round-trip test still expects two contracts to refuse on their `bit` column

- Where: `test/integration/test/psl-print/every-postgres-contract-roundtrip.integration.test.ts`, the expected refusals for `test/integration/test/planner-golden/fixtures/postgres/generated/contract.json` and `test/integration/test/ports/engines/queries/data_types/native/postgres/_fixture/string/generated/contract.json`.
- What is wrong: before this dispatch no PSL type produced `pg/bit@1`, so `contract print` refused those contracts on their `bit` column. `Bit` now prints that column, and print refuses on the next column instead: `"public"."other_codec"."pgChar"` and `"public"."Child"."char"`, both `pg/char` with codec `pg/char@1`. The test fails four times (two files, two vitest projects). Print still refuses both contracts, so no print output changes and the halt condition does not apply.
- Change: update both expected refusals to the `pg/char` columns the test now reports. Run this file in each dispatch that touches constructors or print.

#### U-b-R1-2 (low): the PSL interpreter's README omits the new constructors

- Where: `packages/2-sql/2-authoring/contract-psl/README.md` line 21, the list of Postgres native storage types the interpreter resolves in type position.
- What is wrong: the list does not name `Bit`, `VarBit` or `Interval`.
- Change: add them to the list.

### Dispatch b, round 2

U-b-R1-1 is closed. The print round-trip test expects the `pg/char` refusals and passes at the head of dispatch c. U-b-R1-2 is closed: the contract-psl README names `Interval`, `Bit` and `VarBit`.

### Dispatch c, round 1

Checks run: root `pnpm typecheck:agent`, `pnpm lint:deps`, `pnpm lint:framework-vocabulary`, and `pnpm lint` in target-postgres, family-sql, pgvector and postgis passed. `pnpm test` passed in target-postgres, family-sql, pgvector, postgis, the Postgres extension package and supabase. In `integration-tests` I ran `test/psl-print`, `infer-roundtrip-runtime`, every `infer-roundtrip-fidelity` journey, and the contract-infer-workflow, brownfield-adoption, native-enum-adoption, bytea-defaults, date-time-default-canonical-form, sql-expression-literals, control-plane-commands-without-temporal, composite-pk-greenfield, index-name-convergence and sign-the-database journeys, plus `cli.db-introspect`. All 58 files passed, so print output is unchanged and no infer journey changed. No `as`, `any`, `@ts-expect-error` or import extension was added in production code.

Items 1 to 6 are built as the brief says. The only expected output an existing test changed is `Char(1)` to `Char` in `inferred-psl.defaults-and-types.test.ts`, which item 2 asks for. The Unsupported snapshot and the "falls back to the raw expression" case now expect `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED`.

The dispatch d grep finds only what d still removes: the printer's `isUnsupported`, the `not.toContain('Unsupported(')` assertions in `infer-psl-contract.enum-adoption.test.ts`, `inferred-psl.enums.test.ts` and `native-enum-adoption.e2e.test.ts`. The table and type-map names, and `NOT_YET_WRITTEN_BY_INFER`, are gone from `packages`.

The implementer's choices and the coordinator's questions:

- Resolving only over data types with a marked constructor gives the same result as resolving over the whole stack. Assembly refuses two data types whose claiming texts collide or which claim the same kind (`findSqlDataTypeCollision`), and two constructors marked for one data type (`enforceDataTypeInvariants`). So a reported type matches at most one data type in the stack. When that type is marked, the smaller set finds it too. When it is not marked, the smaller set finds nothing. Both cases end in `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED`, which is the one error design 13.2 asks for.
- The Supabase script. On `origin/main` (`dfc44c5ac5`, the branch base), `contract infer` writes a `timestamptz` column through `PRESERVED_NATIVE_TYPES`, which maps it to `EXISTING_COLUMN_DATE_TIME_TYPES.timestamptz`, and that is `'TimestamptzString'` (since TML-3366, #30553). So `main` also generates `TimestamptzString`, and the committed `contract.prisma` is out of date on `main`. The script's alias table still keys `CreatedAt` on `Timestamp`, which infer stopped writing at the same time. I ran `contract:generate` at the head of this dispatch. It hit no unclaimed column. Ignoring whitespace, the generated schema differs from the committed one only in `Timestamptz` to `TimestamptzString`, `Timestamp`/`CreatedAt` to `TimestampString`, and relation `index: false` to the index's name, which comes from foreign-key work on `main`. I restored the three files afterwards.

#### U-c-R1-1 (must-fix): infer also resolves a column from its written `nativeType`, a path only test columns use

- Where: `packages/3-targets/3-targets/postgres/src/core/psl-infer/infer-column-types.ts`, `resolveColumnType`'s `resolveWrittenSqlTypes(column.nativeType, ...)` branch and the `column.reportedType?.text ?? column.nativeType` in the unclaimed line.
- What is wrong: Postgres introspection always sets `reportedType`, because `format_type` of a column's type is never null. Every production caller of infer passes an introspected schema: the CLI, the SQL family instance and the Supabase script. So the second branch runs only for hand-built columns in tests. It is a second way of resolving a column type, it reads the written form that design 11 says infer must not depend on, and it lets tests pass without exercising the reported-type path.
- Change: a column without `reportedType` is an `InternalError` (it did not come from introspection), and the unclaimed line prints `reportedType.text`. The test helpers that build schema IR columns (the `psl-infer/fixtures.ts` builders and the tests that build columns by hand) derive `reportedType` from the written type, for example through `resolveWrittenSqlTypes` and `renderSqlCatalogText` in the helper. Sweep the same class in `default-fidelity.integration.test.ts`: its `inferredCodecRef` resolves the introspected element type from written text with `resolveWrittenSqlTypes`; read the column's `reportedType` instead.

#### U-c-R1-2 (low): the unclaimed message says no data type claims a type that one does

- Where: the message `contract infer: no data type in the configured stack claims these column types:`, which the brief prescribes.
- What is wrong: a `tsquery` column is listed under that heading, although `pg/tsquery` claims it. It has no marked constructor. The error reference entry describes both cases correctly.
- Change: for the coordinator to decide. One option is "Prisma 8 cannot write these column types with the configured stack:".

### Dispatch c, round 2

U-c-R1-1 is closed. `infer-column-types.ts` throws an `InternalError` for a column without `reportedType`, and the unclaimed line prints `reportedType.text`. No production code reads the written `nativeType` to pick a column type any more. `default-fidelity.integration.test.ts` now reads `format_type` of the element type, `nspname` and `typname` from the catalog, joined on `typarray` as introspection does, and resolves that.

The test helpers in `test/psl-infer/fixtures.ts` derive `reportedType` from a fixture's written type through `resolveWrittenSqlTypes` and `renderSqlCatalogText`. I checked the result against PGlite's `format_type` for every written type the Postgres infer tests use, plus `char`, `bit`, `varchar`, `timetz` and `interval`: 35 types, all identical (for example `int4` gives `integer`, `varchar(191)` gives `character varying(191)`, `timestamptz(3)` gives `timestamp(3) with time zone`, `char` gives `character(1)`, `numeric(5,-2)` stays `numeric(5,-2)`). A type no data type reads, such as `hstore` or an enum name, keeps its written text with `kind` undefined and schema `pg_catalog`. Real introspection would give a different schema and, for an enum or domain, a kind. Infer skips enum columns before it resolves, and a domain or unknown type is unclaimed either way, so no test result depends on this.

U-c-R1-2 is closed: the heading reads "Prisma 8 cannot write these column types with the configured stack:", and the error reference describes both cases.

Checks: target-postgres `test/psl-infer` and `default-fidelity.integration.test.ts` (22 files) passed; the package suites and integration files listed under dispatch d below ran at the same head.

### Dispatch d, round 1

Checks run: `pnpm build`, root `pnpm typecheck:agent`, `pnpm lint:deps`, `pnpm lint:framework-vocabulary`, and `pnpm lint` in psl-printer, contract-psl, family-sql, target-postgres and the Postgres extension package passed. `pnpm test` passed in psl-printer, contract-psl, family-sql, target-postgres, the Postgres extension package, pgvector, postgis and the language server. In `integration-tests`, `cli.emit-command.test.ts`, `native-enum-adoption.e2e.test.ts`, `every-postgres-contract-roundtrip.integration.test.ts`, `infer-roundtrip-runtime.integration.test.ts` and `infer-roundtrip-fidelity.e2e.test.ts` passed (10 runs, 674 tests).

Both grep checks from the plan pass. `Unsupported(` outside the Prisma 6 and Prisma 7 readers and the Postgres extension README appears only in the new message and its two tests. The table and type-map names and `isUnsupported` are gone.

Item 2 is built as ruled. `describeUnresolvedSqlType` is a factory like Mongo's `describeUnresolvedMongoType`, and the SQL family descriptor passes it as `pslDiagnostics.describeUnresolvedType`. It returns the message only for `Unsupported` called with one string argument. The binder test `leaves an unknown type name to the binder` now runs with the hook installed and still expects `Cannot find type "Missing"`. `cli.emit-command.test.ts` still expects `Cannot find type "Unsupported"` for a bare `Unsupported`. The language server passes the family's `pslDiagnostics` to the binder (`language-server/src/config-resolution.ts`), so it shows the new message with no extra code. The test through the SQL family in `native-type-parity.test.ts` covers that path.

The five removed `not.toContain('Unsupported(')` assertions were not the only check of anything. Each sat next to a positive `pg.enum(<Name>)` assertion for the same column. If an enum column fell through to the data type path now, infer would throw `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED` and the test would fail anyway. The enum test that asserted only the absence now asserts `aal pg.enum(AalLevel)?`. The scorecard row is updated.

#### U-d-R1-1 (low): the SQL PSL interpreter's README does not mention the new message

- Where: `packages/2-sql/2-authoring/contract-psl/README.md`.
- What is wrong: the Mongo interpreter's README documents its `describeUnresolvedType` hook. The SQL README says nothing about `describeUnresolvedSqlType` or the message for `Unsupported("x")`.
- Change: add one line naming the export and what it reports. Dispatch e can carry it with the other docs.

### Dispatch e, round 1

Checks run: `pnpm lint:deps`, `pnpm lint:docs`, `pnpm check:error-reference`, `pnpm lint:framework-vocabulary`, `pnpm fixtures:check` (tree left clean) and root `pnpm typecheck:agent` passed. `marked-types-round-trip.integration.test.ts`, `infer-pgvector-column.e2e.test.ts` and `native-enum-adoption.e2e.test.ts` passed (6 runs, 12 tests).

`pnpm test --coverage` passed in every package the branch touches against `origin/main`. A package's own vitest config does not read `coverage.config.json`: only the root config applies its include, exclude and thresholds (`scripts/coverage-config.js`). So the package run's "All files" row also counts test fixtures. The table compares the `src` row with each package's thresholds; every threshold holds.

| Package | `src` statements, branches, functions, lines | Thresholds (statements, branches, functions, lines) |
| --- | --- | --- |
| framework-components | all files 92.16, 87.5, 93.18, 93.08 | none |
| psl-printer | 95.7, 86.41, 96.22, 97.36 | 95, 85, 95, 95 |
| sql-contract | 93.41, 88.31, 95.5, 94.72 | 91, 85, 92, 90 |
| sql-schema-ir | all files 99.46, 97.23, 100, 99.68 | 95, 95, 95, 95 |
| contract-psl | 93.02, 85.98, 96.33, 94.78 | 85, 81, 95, 85 |
| family-sql | all files 85.74, 76.37, 86.05, 87.6 | none |
| pgvector | all files 97.45, 96.87, 95.65, 97.94 | 95, 95, 95, 95 |
| postgis | all files 98.07, 95.86, 92.64, 97.99 | 90, 85, 90, 90 |
| Postgres extension | all files 93.77, 93.93, 90.58, 95.51 | none |
| target-postgres | all files 91.4, 84.25, 92.29, 92.32 | 79, 65, 88, 79 |
| adapter-postgres | all files 94.75, 89.68, 96.67, 95.16 | 84, 77, 88, 84 |
| adapter-sqlite | all files 86.26, 81.54, 85, 86.32 | none |

The new and rewritten source files are fully covered except one line: the namespace-building callback in `inferredConstructorCall` (`psl-print/column-types.ts` line 74). It runs only for a namespaced marked constructor such as `pgvector.Vector`. Within target-postgres no test reaches it, but the print round-trip integration test does, through the pgvector contracts.

The round trip covers all 23 non-enum data types with a marked constructor, each bare and with arguments where the constructor takes them, as a column and as a list, plus the `tsquery` failure. Leaving out `pg/enum` is right: `native-enum-adoption.e2e.test.ts` infers an enum column from a real database and emits the result. The round trip compares codec, data type, normal-form parameters and `many`, so a wrong argument that changes the parameters fails it. It would not see `Numeric(10, 0)` printed instead of `Numeric(10)`, because both have the same normal form. The printed text is checked in `infer-column-types.test.ts`: `numeric(10,0)` gives `Numeric(10)`, `character(1)` gives `Char`, `bit(1)` gives `Bit`. Its reported texts are what PGlite returns, as checked in dispatch c round 2.

The docs match the code. The Postgres target README describes infer, the unclaimed error and print's use of the marked constructor. The family README's `./psl-build` line, the scorecard row and the codec guide's placeholder sentence are right. No skill outside the released upgrade instructions mentions `Unsupported(` in infer output.

U-d-R1-1 is closed: the contract-psl README names `describeUnresolvedSqlType`, how the SQL family contributes it, and that other unknown names keep `Cannot find type`.

#### U-e-R1-1 (low): the round trip's list of types is written by hand

- Where: `AUTHORED_TYPES` in `test/integration/test/psl-infer/marked-types-round-trip.integration.test.ts`.
- What is wrong: a constructor marked `inferred` later is not covered until someone adds a row, and nothing fails to say so.
- Change: assert that the data types of `AUTHORED_TYPES` plus `pg/enum` equal the data types of the stack's marked constructors, or build the bare rows from that list.

#### U-e-R1-2 (low): the codec guide and the `inferred` doc comment say `contract print` writes the marked constructor without its condition

- Where: `docs/reference/codec-authoring-guide.md` ("Declaring a data type") and the doc comment of `AuthoringTypeConstructorDescriptor.inferred`.
- What is wrong: print writes the marked constructor only when it produces the column's codec. A `timestamptz` column with the `Temporal` codec prints `DateTime`, not `TimestamptzString`. The Postgres target README states the condition. The wording follows the brief.
- Change: for the coordinator to decide; for example "`contract print` writes it when it produces the column's codec".

### Branch review fixes, round 1

Checks run: `pnpm build`, root `pnpm typecheck:agent`, `pnpm lint:deps`, `pnpm lint:framework-vocabulary`, `pnpm check:error-reference`, `pnpm lint:docs` and `pnpm lint:manifests` passed. `pnpm test --coverage` and `pnpm lint` passed in publish-surface, framework-components, sql-contract, sql-schema-ir, contract-psl, family-sql, target-postgres, the Postgres extension package, pgvector and postgis. `pnpm test` passed in supabase and the language server. The `src` rows meet every threshold; the new family files are covered except the `InternalError` for a column the lookup never resolved (`column-types.ts` line 97). In `integration-tests`, 27 files passed under both projects (54 runs, 938 tests): the new language server test, the pgvector journey, the marked-types round trip, native-enum-adoption, `test/psl-print`, `cli.emit-command`, `infer-roundtrip-runtime`, every `infer-roundtrip-fidelity` journey, brownfield-adoption, contract-infer-workflow, and both existing language server parity tests.

Every finding is closed as ruled; the commit for each is in the closing notes of `reviews/system-design-review.md` and `reviews/code-review.md`.

The move:

- The family's `psl-build/column-types.ts` and `psl-build/inferred-type-constructors.ts` hold no Postgres fact: no type name, schema name or config key. `isEnumColumn` is the target's callback.
- `fewestArgumentsCall` now starts from `authoringTypeConstructorArguments`, which requires the full call to produce exactly the normal-form parameters, then drops arguments from the end. The unit test, the marked-types round trip and the infer journeys give the same output as before.
- `@internal/sql-contract-psl/diagnostics` is published the way the package's other subpaths are: the package `exports` entry, the `tsdown` entry, `publish-surface`'s `shells.ts` subpath list and its test, and `./contract-psl/diagnostics` in `@prisma/orm-family-sql/package.json`. The shell's `src-gen` re-export is generated by the build. The package's "Public API" list does not name `./attribute-specs`, `./default-table-name` or `./diagnostics`; it did not name the first two before either.
- No copy of the constructor walker or of the argument mapping is left in the target or the family.

D03, checked against the behaviour the coordinator named:

- An enum in another schema is adopted. The enum-adoption tests for the `auth` schema and for a column reported as `auth.aal_level` pass, with the fixture reporting `kind: 'enum'`, schema `auth`.
- A column typed by a pack-owned enum still fails with `CONTRACT.INFER_UNSUPPORTED`, now found by the reported schema and name. The test "throws an actionable error when a surviving column is typed by a pack-owned enum type" passes, for the bare and the qualified spelling. The subtraction test passes too.
- A column whose enum block is absent is not treated as an enum. I ran it through the infer fixtures without committing anything. A column reported as enum `other.mood`, with no block, fails with `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED` naming `public.t.m: other.mood`. With a `mood` block in `public`, a column reported as `other.mood` also fails, and one reported as `public.mood` prints `pg.enum(Mood)?`. No committed test covers the two failing cases (U-rf-R1-1).

#### U-rf-R1-1 (should-fix): no test shows that a column whose enum block is absent is not treated as an enum

- Where: `packages/3-targets/3-targets/postgres/test/psl-infer/infer-psl-contract.enum-adoption.test.ts`, next to the pack-owned tests.
- What is wrong: `adoptedEnumTypeName` checks the kind, the schema and that a block of that name exists. The tests cover the cases where a block exists and the pack-owned case. Nothing fails if the schema check or the block check is removed: such a column would then print `pg.enum(<Name>)` with no block, which `contract emit` refuses.
- Change: add a test that infers a column reported as an enum in a schema with no such block (and one whose block exists only in another schema), and expects `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED` naming the column with its reported text.
