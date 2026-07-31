# Brief: D3 — pre-iteration invalidation guard in `withTransaction`

## Task

In `packages/2-sql/5-runtime/src/sql-runtime.ts`, add a pre-iteration `invalidated` check to `withTransaction`'s guarded generators (both `execute` and `executePrepared`, around lines 776 and 795), **such that** consuming an escaped transaction-scoped result after the transaction has ended rejects with `RUNTIME.TRANSACTION_CLOSED` deterministically on every driver — including single-connection drivers (SQLite) whose connection is closed on COMMIT/ROLLBACK and which today throw a raw `database is not open` from the driver before the existing in-loop check can fire. The in-loop check stays (it covers invalidation mid-stream); the new check runs at the top of the guarded generator body, before `for await (const row of inner)` first pulls from the driver. No other `withTransaction` semantics change. Tests first.

## Scope

**In:**

- `packages/2-sql/5-runtime/src/sql-runtime.ts` — the pre-iteration check in the two guarded generators (small, symmetric).
- A sql-runtime unit test pinning: a result obtained from the transaction context but first consumed after the transaction ends rejects with `RUNTIME.TRANSACTION_CLOSED` *without the driver being asked for rows* (assert via a stub driver/queryable that records calls). Place it next to the package's existing `withTransaction` tests (grep for them; follow the file-organization conventions).
- `test/e2e/framework/test/sqlite/transaction.test.ts` — strengthen the escaped-result assertion from generic `rejects.toThrow()` to matching the `TRANSACTION_CLOSED` error (mirror how Postgres e2e matches it; check `test/e2e/framework/test/transaction.test.ts`), and update/remove the explanatory comment about the driver-error gap.

**Out:**

- Any other change in `sql-runtime.ts` (commit/rollback/cleanup paths untouched).
- `packages/3-extensions/**` — facade is frozen.

## Completed when

- [ ] New sql-runtime unit test passes and proves the driver is not consulted post-invalidation.
- [ ] Gates: `pnpm --filter @internal/sql-runtime test`, package typecheck (+ test project), package lint — green.
- [ ] Shared-substrate regression gates: `pnpm --filter e2e-tests test -- test/sqlite` green AND the Postgres-path transaction e2e files green (`pnpm --filter e2e-tests test -- test/transaction` or the harness's path filter covering `transaction.test.ts` + `transaction-orm.test.ts`).
- [ ] No new bare casts (`pnpm lint:casts` delta 0).
- [ ] New commit(s), explicit staging, sign-off, message referencing TML-2843.

## Standing instruction

Stay focused; control scope. Destructive git operations forbidden. If the pre-iteration check breaks an existing runtime test that *intentionally* consumes results after transaction end (unlikely — that's the bug class being fixed), HALT and surface rather than adapting the existing test's semantics silently.

## Operational metadata

- **Model tier:** mid (Sonnet). **Time-box:** 30 min. Overrun → halt and surface.
- **Halt conditions:** the fix requires touching more than the two generator bodies; any Postgres-path e2e goes red; existing runtime tests encode the opposite semantics.
