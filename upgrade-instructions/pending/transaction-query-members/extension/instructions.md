---
changes:
  - id: transaction-query-members
    summary: |
      Additive for code that only uses these types: a transaction now offers the client's query members (`sql`, `orm`, `raw`, `prepare`, `query`, `execute`) on every SQL client, a Supabase role-bound client gains `prepare`, and SQLite's `db.orm` gains `fragment`. Code that builds its own object of one of the changed types must add the new members. Changed: `PostgresTransactionContext` (adds `raw` and `prepare`), `SqliteTransactionContext` (adds `raw` and `prepare`; `orm` is now `SqliteOrm`), `RoleBoundDb` (adds `prepare`; `transaction` passes a `SupabaseTransactionContext`). New: `PostgresTransactionQueryMembers`, `SupabaseTransactionContext`, `SqliteOrm`, and `OrmClientMembers` from the ORM client. The detection matches a file that names one of these types.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      matches:
        - '(?<![\w$])(?:PostgresTransactionContext|SqliteTransactionContext|RoleBoundDb|SupabaseTransactionContext|PostgresTransactionQueryMembers|SqliteOrm|OrmClientMembers)(?![\w$])'
---

# A transaction offers the client's query members

Inside `db.transaction(async (tx) => …)`, `tx` now has the client's query members with the same types: `sql`, `orm` (with the client's custom collection classes), `raw`, `prepare`, `query` and `execute`. This holds for `postgres()`, every serverless connection, `sqlite()` and every Supabase role-bound client. A prepared statement runs on whatever it is given, so `ps.query(tx, params)` runs inside the transaction; `tx.prepare` lets code inside a transaction prepare without the outer client.

Code that only reads these types needs no change. Code that creates an object of one of them, for example a test double typed `PostgresTransactionContext<Contract>`, must add the new members:

| Type | New or changed members |
| --- | --- |
| `PostgresTransactionContext` (`@prisma/orm-postgres/runtime`) | `raw`, `prepare`; its query members are also the new `PostgresTransactionQueryMembers` |
| `SqliteTransactionContext` (`@prisma/orm-sqlite/runtime`) | `raw`, `prepare`; `orm` is `SqliteOrm`, the namespace's models plus `fragment` |
| `SqliteClient['orm']` | `SqliteOrm`, which adds `fragment` |
| `RoleBoundDb` (`@prisma/orm-extension-supabase/runtime`) | `prepare`; `transaction` passes a `SupabaseTransactionContext` instead of a plain `TransactionContext` |
| `OrmClientMembers` (ORM client) | newly exported: the members of the ORM client beside its namespaces, today `fragment` |

A callback typed to take a plain `TransactionContext` still compiles where a transaction context is passed, because each new context type extends it.
