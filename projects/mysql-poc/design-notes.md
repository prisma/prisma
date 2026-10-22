# Design notes — MySQL proof of concept

The reasoning behind each decision in [`spec.md`](./spec.md), the facts it rests on, and the alternatives rejected. Settled in discussion with Will on 2026-10-22.

## 1. One folder per database

**Today.** SQL targets are split by role: `3-targets/3-targets/<db>`, `3-targets/6-adapters/<db>`, `3-targets/7-drivers/<db>`. Mongo keeps its three packages together in `3-mongo-target/`. The facades sit apart from both in `3-extensions/<db>`.

**Decision.** Every database gets one folder, `packages/3-targets/<db>/`, holding `1-target`, `2-adapter`, `3-driver`, `4-codec-testkit` and `9-facade`. Mongo moves too. `2-sql` becomes `2-sql-family`, to match `2-mongo-family`. Extension packs stay in `3-extensions/`.

**Why.**

- The role folders enforce nothing. Domain, layer and plane come from per-file globs in `architecture.config.json`, and that file defines no layer order for the `targets` or `extensions` domains, so the numbers 3, 6 and 7 constrain no import.
- One database's code was spread across three subtrees plus the facade in a fourth. A developer working on a target now opens one folder.
- Package names do not change, so imports, published names and emitted code are untouched. Only `architecture.config.json`, `shells.ts`, `coverage.config.json`, `tsconfig.base.json`, three lint scripts and the docs name paths.
- Numbers inside a database folder keep the repo's convention that a number shows dependency order: the adapter imports the target, the facade imports all three, the driver imports none of them.
- The facade is one database's wiring, so it belongs with the database.
- Extension packs stay apart because they use the same extension points as a third-party pack; keeping first-party packs outside the target shows that.

**Rejected.**

- *Copy Mongo exactly* (`packages/3-mysql-target/{1-mysql-target,...}`): a new top-level folder per database, and the database name repeated in every folder name.
- *Keep the role layout for MySQL*: repeats the spread the move fixes.
- *Move the Postgres-only extension packs under `3-targets/postgres/`*: hides that they are ordinary packs.

**What it reverses.** `.agents/rules/directory-layout.mdc`, ADR 140, `docs/architecture docs/Package-Layering.md` and the Architecture Overview name `packages/3-targets/**` by role as the SQL target home, with MySQL as the example. They are rewritten with the move, and an ADR records the new layout. Mongo's own split (commit 8d14500992) was never recorded as a decision.

## 2. One path through the system

**Decision.** A small PSL contract, migrations, `db verify`, `db sign`, and ORM create, read with include, update, delete and upsert, on MySQL 8.4.

**Why.** The two goals pull apart: finding coupling needs MySQL to touch every subsystem; being production groundwork needs what is built to be correct. A narrow path through every subsystem serves both. The path meets all four known problems: `RETURNING`, transactional DDL, upsert conflicts and shared code that names targets.

**Rejected.** *A broad, shallow MySQL* (many types, stubbed behaviour): finds less coupling per unit of work and leaves code that must be rewritten.

## 3. MariaDB is a separate target that extends MySQL

**Decision.** A `mariadb` target that subclasses the MySQL target, adapter and facade and overrides what differs. Built after MySQL. Will asked for the research to be done and the decision made; these are its findings.

**Why.** Several differences are not capabilities. They change data types, introspection or the shape of SQL, which the target owns:

- **Relation loading.** The ORM loads an include as a scalar subquery over a derived table that refers to the outer row. MariaDB cannot resolve an outer reference inside a derived table and fails with "Unknown column" (MDEV-39357, a duplicate of the open `LATERAL` request MDEV-19078). Prisma 7 disabled relation joins on MariaDB for the same reason. MariaDB needs the correlation in the subquery's own `WHERE`, with `JSON_ARRAYAGG(... ORDER BY ... LIMIT n)`.
- **JSON.** MariaDB's `JSON` is `LONGTEXT` with an automatic `json_valid` check; `information_schema` reports `longtext`. Treated as MySQL, every JSON column would fail verification and the planner would try to change it.
- **Defaults.** MariaDB quotes literal defaults in `COLUMN_DEFAULT`, writes `current_timestamp()`, and has no `DEFAULT_GENERATED`.
- **Types.** MariaDB reports integer display widths (`int(11)`) and has native `UUID`, `INET4` and `INET6`.
- **Syntax.** MariaDB rejects MySQL's `AS new` row alias in upserts and `FOR SHARE`; it has `RETURNING` on `INSERT` and `DELETE` and MySQL has none.
- **Shared:** wire protocol, drivers (`mysql2` serves both), `VALUES()` upserts, CTEs, window functions, identifier rules, implicit commit on DDL. That much sharing suits subclassing.

Hibernate makes the same split (`MariaDBDialect extends MySQLDialect`). TypeORM and Sequelize distinguish the two as well.

**Assumptions.** MariaDB 10.11 is the floor. The Prisma 7 reader for both targets accepts `provider = "mysql"`, because Prisma 7 used that one provider for both and the project config already says which target applies.

**Rejected.** *One `mysql` target with a MariaDB adapter option*: the data types would be shared, so a MariaDB JSON column could not verify, and relation loading would still need a different SQL shape.

## 4. Writes return rows without `RETURNING`

**Today.** Every ORM write that returns rows asserts the `returning` capability (`assertReturningCapability`, `sql-orm-client/src/collection-contract.ts`). The write returns its identity columns through `RETURNING`; the ORM then reads the rows back through the read path, keyed by `identity IN (...)`, in the same transaction (`collection-dispatch.ts`, `#reloadMutationRowByIdentity` in `collection.ts`). `delete` already reads its snapshot before deleting. A mutation graph with more than one statement runs in a transaction (`mutation-graph/run-graph.ts`).

**Decision.** On a target without `RETURNING` for a statement, the identity comes from somewhere else:

- `create`: the key values the client generated, or the insert id the driver reports. A multi-row insert relies on MySQL assigning consecutive ids, which the project checks on a live server.
- `update`: select and lock the matching keys first, update by those keys, then read back. This also covers an update that changes the key.
- `delete`: unchanged.

The `returning` capability splits by statement (insert, update, delete), because MariaDB has it for insert and delete only. `SqlStatementStats` gains the last insert id.

**Why.** Will, 2026-10-22: consistent with the principles, because the user asked the ORM for the rows. The read-back machinery exists, so the change is limited to finding the identity.

**Rejected.** *Refuse every row-returning write on MySQL*, leaving only the `*AndCount` methods: keeps one statement per call but makes the ORM close to unusable.

## 5. Migration atomicity is a target fact

**Today.** `SqlMigrationRunner.execute` promises that a failure on any space rolls back every space's writes (`packages/2-sql/9-family/src/core/migrations/types.ts`), and the CLI and ADR 212 repeat it. `db sign` creates the marker table inside the transaction that writes markers.

**Decision.** Whether a failed apply rolls back is a fact the target states. The MySQL runner applies and verifies one space at a time and writes each space's marker only after verification passes, like the Mongo runner. Re-running a failed apply resumes. Operations keep their postchecks, so a re-run skips what was applied.

**Why.** MySQL commits implicitly on every DDL statement. The promise cannot hold there; this is forced, not chosen. The Mongo family already documents and implements the same model.

**Open in the build.** The marker lock: MySQL's `GET_LOCK` holds per session, not per transaction, so `lockMarker` needs a release.

## Settled by testing in the proof of concept

These are SQL-shape details the slices decide against a live server, and record here.

- How MySQL keeps related rows in order, since `JSON_ARRAYAGG` takes no `ORDER BY`.
- How MariaDB loads relations without `LATERAL`.
- Whether a multi-row insert's ids are consecutive under MySQL's default auto-increment lock mode.
- Whether an `UPDATE` or `DELETE` whose subquery reads the same table (MySQL error 1093) occurs in the ORM's statements.
