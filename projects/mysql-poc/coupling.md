# Coupling register

Each place where shared code assumes Postgres or SQLite in a way MySQL or MariaDB does not share. Found by reading the code on 2026-10-22; slices add entries as they find more. Paths start at the package, named without its `@internal/` scope.

**Breaking** means the fix changes a public or cross-package API. A breaking entry is fixed in this project. A non-breaking entry may be filed as a Linear issue instead.

**Outcome** is one of: open, fixed in a slice (with the pull request), or filed (with the Linear issue).

| # | Where | Assumes | MySQL / MariaDB needs | Breaking | Outcome |
| --- | --- | --- | --- | --- | --- |
| 1 | `sql-orm-client/src/collection-contract.ts` `assertReturningCapability`, called by `create`, `createAll`, `upsert`, `update`, `updateAll`, `delete`, `deleteAll` | Every row-returning write has `RETURNING` | Identity from the insert id, client keys, or a select before the write | Yes: capability shape | Open |
| 2 | `sql-orm-client/src/mutation-graph/` (`graph.ts`, `run-graph.ts`, `insert.ts`, `collection-graphs.ts`), `mutation-executor.ts` `insertSingleRow` | Each graph step passes rows to the next through `RETURNING` | The same steps fed by the insert id or a select | No | Open |
| 3 | `sql-relational-core/src/ast/driver-types.ts` `SqlStatementStats`; `sql-contract/src/types.ts` control driver result | A write reports only `affectedRows` | The last insert id | Yes: driver interface | Open |
| 4 | `family-sql/src/core/migrations/types.ts` `SqlMigrationRunner.execute`; CLI `db-run.ts`, `run-migration.ts`, `migrate.ts`; `framework-components/src/control/control-instances.ts`; ADR 212 | A failed apply rolls back every space, because DDL is transactional | Atomicity stated by the target; per-space resume | Yes: documented contract | Open |
| 5 | `family-sql/src/core/control-instance.ts` `signSpaces` | Creating the marker table and writing markers share one transaction | Create the table first, then write markers | No | Open |
| 6 | `family-sql/src/core/control-adapter.ts` `lockMarker` | The lock is released when the transaction ends | `GET_LOCK` holds per session; needs a release | Yes: control adapter interface | Open |
| 7 | `sql-relational-core/src/ast/types.ts` `InsertOnConflict`; `sql-orm-client/src/query-plan-mutations.ts`; `collection-contract.ts` `assertInsertConflictSkipCapability` | A conflict names its target columns; skipping without a target is the extra capability | `ON DUPLICATE KEY UPDATE` and `INSERT IGNORE` fire on any unique key and cannot name a target | Yes: capability model | Open |
| 8 | `sql-orm-client/src/collection-graphs.ts`; `sql-relational-core/src/contract-free/table.ts`; both adapters | The `excluded` pseudo-table names the proposed row | MySQL `AS new` row alias; MariaDB `VALUES()` | No: adapter rendering | Open |
| 9 | `sql-contract-psl/src/interpreter.ts` (`=== 'sqlite'`, `=== 'postgres'`); `sql-contract-ts/src/contract-builder.ts` (four places) | Names targets to refuse namespace blocks and reserve `unbound` | Read `supportsNamespaces` and reserved names from the target | No | Open |
| 10 | `sql-orm-client/src/collection-contract.ts`, `collection.ts`; `sql-builder` `select-query.ts`, `grouped-query.ts`, `query-impl.ts` | `distinctOn` is checked under the `postgres` capability group | A family capability key | Yes: capability key | Open |
| 11 | `sql-relational-core/src/ast/types.ts` lock strengths; `collection.ts` `forNoKeyUpdate`, `forKeyShare` | Postgres-only lock strengths sit on the shared AST and the shared collection API | Methods only where the target reports them | Yes: collection API | Open |
| 12 | `sql-contract/src/sql-raw.ts` | A raw type name uses double quotes and Postgres's `[]` suffix | Backticks, and `enum('a','b')` | No | Open |
| 13 | `family-sql/src/core/migrations/types.ts` `SqlPlanTargetDetails.schema` | Every target has a schema name (SQLite fakes `'main'`) | Optional, or the namespace | Yes: planner interface | Open |
| 14 | `sql-schema-ir/src/naming.ts` `WIRE_NAME_PREFIX_MAX_BYTES` | Identifier limit is Postgres's 63 bytes | MySQL allows 64 characters; the limit should come from the target | No | Open |
| 15 | `family-sql/src/core/migrations/sql-expression-text.ts` | SQL comments are `--` and `/* */` | MySQL also has `#` | No | Open |
| 16 | `sql-orm-client/src/query-plan-select.ts` `JsonArrayAggExpr` ordering | The aggregate orders its rows | MySQL `JSON_ARRAYAGG` takes no `ORDER BY` | Unknown | Open: decided by test |
| 17 | `sql-orm-client/src/query-plan-select.ts` include shape | A derived table inside a scalar subquery can refer to the outer row | MariaDB cannot | Unknown | Open: decided by test |
| 18 | `sql-orm-client/src/query-plan-mutations.ts` `countMutationWhere` | An `UPDATE`/`DELETE` may read its own table in a subquery | MySQL error 1093 refuses that | Unknown | Open: decided by test |
| 19 | `sql-orm-client/src/collection.ts` `*AndCount` | `affectedRows` counts matched rows | MySQL counts changed rows unless the driver sets found-rows; an upsert reports 1 or 2 | No | Open |
| 20 | `sql-contract-prisma7/src/target-binding.ts` `nativeEnum` | A native enum is a named entity (Postgres `CREATE TYPE`) | MySQL `ENUM` is a column type | No: Prisma 7 reader is out of scope | Open |
| 21 | CLI `init` (`commands/init/templates/`, `orm/init-inputs.ts`, `orm/init.ts`) | Only Postgres and Mongo exist | A target list from the targets | No | Open |
| 22 | CLI `db-run.ts`, `migration-tools/src/verify-contract-spaces.ts` messages | The marker table has Postgres's or SQLite's name | Names from the target | No | Open |
| 23 | `sql-contract-emitter/src/index.ts` `namespaceSerializedKind` | Every namespace of kind schema is emitted as `"postgres-schema"` or `"postgres-unbound-schema"` | The target supplies the literal | Unknown: changes emitted types | Open |
| 24 | `sql-contract/src/index-naming.ts` | Authored SQL text is compared against Postgres's reprinted form | Compare against the target's reprint | No | Open |
