# TML-3582 build review

## Scoreboard

| Dispatch | Round | Commits | Must-fix | Should-fix | Low | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| a | 1 | `67963d5f75..5a0499d5d4` | 0 | 1 | 1 | ANOTHER ROUND NEEDED |
| a | 2 | `62c15aa65e`, design `72b6bf7d91` | 0 | 0 | 0 | SATISFIED |
| b | 1 | `28bca080c5` | 1 | 0 | 1 | ANOTHER ROUND NEEDED |

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
