# Dispatch plan — sqlite-facade-transaction

Slice spec: [`./spec.md`](./spec.md). Two sequential dispatches; both are recognised clean shapes from `drive/calibration/sizing.md` ("single-package new feature", then a behavior-proof e2e dispatch).

### Dispatch 1: facade transaction surface + package tests

- **Outcome:** `@internal/sqlite` exposes `SqliteTransactionContext<TContract>` and `SqliteClient.transaction<R>(fn)`, implemented by delegating to `withTransaction(getRuntime(), ...)` per the spec's chosen design (Postgres transplant, including the `Object.create(txCtx)` live-getter pattern). Tests written first: new `test/transaction.types.test-d.ts` (return-type inference, `tx.sql` ≡ `db.sql`, `tx.orm` ≡ `db.orm`, no `tx.transaction`) and new `test/transaction.test.ts` facade unit tests (delegates to `withTransaction` with the lazy runtime, provides `tx.sql`/`tx.orm`, lazily creates runtime before `connect()`, rejects after `close()` with `Error('SQLite client is closed')`). Gates: package-scoped typecheck (incl. test project), `pnpm --filter @internal/sqlite test`, `pnpm --filter @internal/sqlite lint` — all green.
- **Builds on:** the spec's chosen design; Postgres precedent at `packages/3-extensions/postgres/src/runtime/postgres.ts:308-337` and its test files as the mirror source.
- **Hands to:** a stable facade surface — `SqliteTransactionContext` and `transaction()` exported from `@internal/sqlite`'s runtime entrypoint with transaction lifecycle semantics fully inherited from `withTransaction`, type/unit-proven, ready for end-to-end consumption.
- **Focus:** `packages/3-extensions/sqlite/**` only. No SQL runtime, driver, or e2e harness changes. The existing `sqlite-close.test.ts` mock of `@internal/sql-runtime` may need `withTransaction` added to its factory once the facade imports it — in scope here. E2E proof is dispatch 2.

### Dispatch 2: e2e behavior proof through the facade

- **Outcome:** new `test/e2e/framework/test/sqlite/transaction.test.ts` exercises `sqlite({ contractJson, path })` directly (per spec open question 1's working position) and proves: commit on success, rollback on error rethrows the callback error, ORM write then read inside one transaction uses the transaction scope, outside-visible state matches commit/rollback, and an escaped transaction result rejects after transaction end. Mind the runtime warm-up edge case from the spec (contract verification vs single-connection deadlock). Gate: `pnpm --filter e2e-tests test` (sqlite suite) green; full `pnpm test:packages` untouched-green.
- **Builds on:** Dispatch 1's exported facade surface.
- **Hands to:** slice-DoD reachable — every "SQLite facade parity" acceptance criterion in `projects/sqlite-mongo-transactions/spec.md` is now backed by a passing test; the slice is PR-ready.
- **Focus:** `test/e2e/framework/test/sqlite/**` only; may reuse schema/seed helpers from `utils.ts`. No facade changes expected — if e2e surfaces a behavior gap in dispatch 1's surface, escalate to the orchestrator (spec amendment per invariant I12) rather than silently patching.

### Dispatch 3: pre-iteration invalidation guard in `withTransaction` _(added 2026-06-05 — operator-approved spec amendment)_

- **Outcome:** `withTransaction`'s guarded `execute`/`executePrepared` generators check `invalidated` before iterating the inner result (in addition to the existing in-loop check), so an escaped transaction result rejects with `RUNTIME.TRANSACTION_CLOSED` on every driver — including single-connection SQLite, whose driver previously threw a raw `database is not open` first. A new sql-runtime unit test pins the pre-iteration rejection; the D2 e2e escaped-result test assertion is strengthened from generic `rejects.toThrow()` to matching the `TRANSACTION_CLOSED` error. Gates: `pnpm --filter @internal/sql-runtime test` + package typecheck/lint, sqlite e2e directory green, and the Postgres-path transaction e2e (`test/e2e/framework/test/transaction.test.ts`, `transaction-orm.test.ts`) still green — the guard is shared substrate.
- **Builds on:** Dispatch 2's e2e harness (the escaped-result test to strengthen) and the root-cause analysis in its report; spec amendment of 2026-06-05.
- **Hands to:** slice-DoD reachable — AC-10 backed by the runtime guard on all drivers; all four D2 behavioral ACs at full strength; PR-ready.
- **Focus:** the one pre-iteration check in `packages/2-sql/5-runtime/src/sql-runtime.ts` + its unit test + the e2e assertion line. No other runtime semantics change; no facade changes.

---

**Completeness check:** type-surface ACs (`tx.sql`/`tx.orm` types, return-type preservation, no nested `transaction`) → dispatch 1 type tests. Lifecycle/guard ACs (lazy runtime, closed-client rejection, `withTransaction` delegation) → dispatch 1 unit tests. Behavior ACs (commit, rollback, ORM scope, escaped-result invalidation) → dispatch 2 e2e. Together they cover the slice-DoD line in the spec.

**Sizing:** dispatch 1 ≈ M (one package, mirrored precedent, tests-first), dispatch 2 ≈ S (one new e2e file against an existing harness).
