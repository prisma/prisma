# TML-3582 build review

## Scoreboard

| Dispatch | Round | Commits | Must-fix | Should-fix | Low | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| a | 1 | `67963d5f75..5a0499d5d4` | 0 | 1 | 1 | ANOTHER ROUND NEEDED |

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
