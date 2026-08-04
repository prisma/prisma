# Slice: sqlite-facade-transaction

Parent project: `projects/sqlite-mongo-transactions/`. Outcome this slice contributes: SQLite reaches facade-level transaction parity with Postgres — `db.transaction(async (tx) => { ... })` works on `sqlite(...)`.

## At a glance

Adds `transaction<R>(fn)` to `SqliteClient<TContract>` in `packages/3-extensions/sqlite/src/runtime/sqlite.ts`, reusing the existing SQL runtime `withTransaction(runtime, fn)` helper. No new transaction machinery — the SQLite driver and SQL runtime already support transactions; only the facade surface is missing.

## Chosen design

Transplant the Postgres facade pattern (`packages/3-extensions/postgres/src/runtime/postgres.ts:308-337`) into the SQLite facade:

```ts
export interface SqliteTransactionContext<TContract extends Contract<SqlStorage>>
  extends TransactionContext {
  readonly sql: Db<TContract>;
  readonly orm: OrmClient<TContract>;
}

// on SqliteClient<TContract>:
transaction<R>(fn: (tx: SqliteTransactionContext<TContract>) => PromiseLike<R>): Promise<R>;
```

Implementation shape, mirroring Postgres exactly:

1. `transaction(fn)` calls `withTransaction(getRuntime(), (txCtx) => { ... })` — the existing `getRuntime()` lazy path already provides the closed-client guard (`Error('SQLite client is closed')`) and lazy runtime creation.
2. Inside the callback, build `txSql` via `sqlBuilder<TContract>({ context, rawCodecInferer })` and `txOrm` via `ormBuilder({ context, runtime: { execute: (plan) => txCtx.execute(plan) } })`.
3. Compose the context as `Object.assign(Object.create(txCtx), { sql: txSql, orm: txOrm })` so the live `invalidated` getter on `txCtx` stays wired (see edge case below).

Commit/rollback/invalidation/connection-cleanup semantics are entirely inherited from `withTransaction` (`packages/2-sql/5-runtime/src/sql-runtime.ts:756`); this slice adds zero transaction-lifecycle logic.

Before/after for users:

```ts
// before — only the low-level helper works for SQLite:
await withTransaction(db.runtime(), async (tx) => { await tx.execute(plan); });

// after — parity with Postgres:
await db.transaction(async (tx) => {
  const user = await tx.orm.User.create({ name: 'Ada' });
  await tx.sql.from('post').insert([{ authorId: user.id, title: 'hi' }]).execute();
});
```

## Coherence rationale

One facade gains one method plus its context type, with the tests that prove parity. Every change serves the single outcome "SQLite facade exposes `db.transaction(...)` with Postgres-equivalent semantics"; a reviewer verifies it by diffing against the Postgres precedent in one sitting.

## Scope

**In:**

- `packages/3-extensions/sqlite/src/runtime/sqlite.ts` — `SqliteTransactionContext<TContract>`, `transaction()` on `SqliteClient` interface + implementation.
- `packages/3-extensions/sqlite/test/transaction.types.test-d.ts` — new; mirror `packages/3-extensions/postgres/test/transaction.types.test-d.ts` (return-type inference, `tx.sql` ≡ `db.sql`, `tx.orm` ≡ `db.orm`, no `tx.transaction`).
- `packages/3-extensions/sqlite/test/transaction.test.ts` — new facade unit tests; mirror the `transaction()` block of `packages/3-extensions/postgres/test/postgres.test.ts:440-519` (delegates to `withTransaction` with lazy runtime, provides `tx.sql`/`tx.orm`, lazily creates runtime before `connect()`, rejects after `close()`), reusing the `vi.hoisted` mock setup from `sqlite-close.test.ts`.
- `test/e2e/framework/test/sqlite/transaction.test.ts` — new e2e through the `sqlite()` facade: commit on success, rollback on error, ORM write+read inside one transaction, escaped result rejects after transaction end.

- `packages/2-sql/5-runtime/src/sql-runtime.ts` — **(amended 2026-06-05, operator decision)** pre-iteration `invalidated` check in `withTransaction`'s guarded generators, so escaped results reject with `RUNTIME.TRANSACTION_CLOSED` before the driver is asked for rows. Discovered during D2: SQLite's synchronous driver closes the transaction connection on COMMIT/ROLLBACK and throws a raw `database is not open` on first row-fetch, so the existing in-loop guard never fires (Postgres keeps the connection alive, masking the gap). The pre-iteration check makes the guard deterministic across drivers; plus a runtime unit test pinning it.

- `examples/prisma-8-demo-sqlite/**` — **(amended 2026-06-05, operator-approved)** a `db.transaction()` demo command (atomic user+posts create via `tx.orm` + `tx.sql`, with a rollback demonstration), plus the matching per-PR declaration in the user upgrade skill (`skills/upgrade/prisma-next-upgrade/upgrades/0.12-to-0.13/`).

**Out:**

- Everything Mongo (slices 2+).
- Postgres behavior changes; SQL runtime changes other than the pre-iteration guard check named above.
- Nested transactions, savepoints, transaction options.
- Docs/README updates (project milestone 6).
- Cross-family transaction abstraction (project non-goal).

## Adapter / contract impact

None. No `packages/3-targets/**` or contract-surface changes — the SQLite driver's transaction support (`BEGIN`/`COMMIT`/`ROLLBACK`) is already in place and untouched.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --------- | ----------- | ----- |
| Spreading `txCtx` freezes the `invalidated` getter | Use `Object.create(txCtx)` prototype pattern | Known footgun documented at `postgres.ts:323-327`; spreading evaluates the closure-backed getter once and breaks post-transaction invalidation |
| Contract verification acquires its own connection; inside a transaction on a single-connection database this deadlocks | Warm up the runtime (one query) before the first transaction in e2e tests | Same pattern as `test/e2e/framework/test/transaction-orm.test.ts:40-45` (PGlite); confirmed during D2 — SQLite driver is single-connection, warm-up applied |
| `withTransaction`'s escaped-result guard checks `invalidated` only inside the row loop; single-connection drivers throw a raw driver error before the loop body runs | Pre-iteration `invalidated` check in the guarded generators (in scope per 2026-06-05 amendment) | Falsified the spec's assumption that invalidation behavior carries over to SQLite unchanged; surfaced by D2, operator-approved scope expansion |

## Slice-specific done conditions

- [ ] All checkboxes under "SQLite facade parity" in `projects/sqlite-mongo-transactions/spec.md` § Acceptance Criteria pass.

## Open Questions

1. Should the e2e tests exercise the `sqlite()` facade directly rather than extending `test/e2e/framework/test/sqlite/utils.ts` (which builds the runtime without the facade)? Working position: yes — a new `transaction.test.ts` that instantiates `sqlite({ contractJson, path })` against the existing fixture contract, since facade behavior is exactly what this slice delivers; reuse `utils.ts` only for schema/seed helpers.
2. Should `SqliteTransactionContext` also expose `raw`? Working position: no — Postgres parity (`sql` + `orm` + inherited `execute`/`executePrepared`/`invalidated` only); `db.raw` is context-free and remains usable inside the callback.

## References

- Parent project: `projects/sqlite-mongo-transactions/spec.md` (§ FR1, FR2, Acceptance Criteria "SQLite facade parity")
- Linear issue: [TML-2843](https://linear.app/prisma-company/issue/TML-2843/sqlite-facade-transaction-parity-dbtransaction-on-sqlite) (parent Linear project: [SQLite & MongoDB transactions](https://linear.app/prisma-company/project/sqlite-and-mongodb-transactions-860f63d3d786))
- Postgres precedent: `packages/3-extensions/postgres/src/runtime/postgres.ts`, `packages/3-extensions/postgres/test/transaction.types.test-d.ts`, `packages/3-extensions/postgres/test/postgres.test.ts`
- SQL runtime helper: `packages/2-sql/5-runtime/src/sql-runtime.ts` (`withTransaction`, `TransactionContext`)
- SQLite facade: `packages/3-extensions/sqlite/src/runtime/sqlite.ts`
- SQLite e2e harness: `test/e2e/framework/test/sqlite/utils.ts`
