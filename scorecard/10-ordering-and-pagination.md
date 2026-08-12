# Ordering & pagination

[← Feature-support matrix index](../scorecard.md)

Legend:

- `✅` **Works** — proven by a Prisma Next **integration** test (one that executes the feature against a database — Postgres via PGlite, SQLite via its real driver, or MongoDB via mongodb-memory-server — and asserts the observable runtime result). Unit-tier tests (SQL/AST/plan/type/snapshot assertions, or any test that never hits a database) do not qualify. Per-database rigor applies: a Postgres integration test cannot justify a SQLite or MongoDB `✅`, and vice versa.
- `🟡` **Untested** — reachable through the Prisma Next public surface, but no proving Prisma Next integration test exists yet (evidence left blank). This includes features whose only backing is a unit-tier test.
- `🧪` **Experimental** — shipped in Prisma Next but outside the stability promise (polymorphism / multi-table inheritance).
- `❌` **Not in 8.0** — deliberately absent from Prisma Next.
- `—` **n/a** — feature does not apply to that database.

| Feature | Postgres | SQLite | MongoDB | Prisma Next evidence |
| --- | --- | --- | --- | --- |
| `orderBy` direction (asc/desc) | ✅ | ✅ | ✅ | `test/integration/test/sql-builder/order-by.test.ts`; `test/e2e/framework/test/sqlite/sql-builder.test.ts` (`ORDER BY`); `test/integration/test/mongo/orm.test.ts` |
| `orderBy` nulls first/last placement | 🟡 | 🟡 | — | |
| `limit` (builder) | ✅ | ✅ | — | `test/integration/test/sql-builder/pagination.test.ts`; `test/e2e/framework/test/sqlite/sql-builder.test.ts` |
| `offset` (builder) | ✅ | ✅ | — | `test/integration/test/sql-builder/pagination.test.ts`; `test/e2e/framework/test/sqlite/sql-builder.test.ts` |
| ORM `take` | ✅ | ✅ | ✅ | `test/integration/test/sql-orm-client/pagination.test.ts`; `test/e2e/framework/test/sqlite/orm.test.ts`; `test/integration/test/mongo/orm.test.ts` |
| ORM `skip` | ✅ | ✅ | ✅ | `test/integration/test/sql-orm-client/pagination.test.ts`; `test/e2e/framework/test/sqlite/orm.test.ts`; `test/integration/test/mongo/orm.test.ts` |
| ORM `cursor` keyset pagination (P7's `cursor: { id }` + `skip: 1` maps onto keyset `.cursor()`) | ✅ | 🟡 | — | `test/integration/test/sql-orm-client/pagination.test.ts` |
| `distinct` | ✅ | 🟡 | — | `test/integration/test/sql-builder/distinct.test.ts`; `test/integration/test/sql-orm-client/pagination.test.ts` |
| `distinctOn` | ✅ | — | — | `test/integration/test/sql-builder/distinct.test.ts`; `test/integration/test/sql-orm-client/pagination.test.ts` |
| Order by related record's field | ✅ | 🟡 | — | `test/integration/test/sql-orm-client/self-relations.test.ts` (`orderBy on a depth-1 self-relation`) |
| Order by relation aggregate (`_count`) | 🟡 | 🟡 | — | |
