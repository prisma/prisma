# Brief: D1 — facade transaction surface + package tests

## Task

Add `SqliteTransactionContext<TContract>` and `SqliteClient.transaction<R>(fn)` to `packages/3-extensions/sqlite/src/runtime/sqlite.ts`, implemented by delegating to `withTransaction(getRuntime(), ...)` from `@internal/sql-runtime`, **such that** SQLite's facade transaction surface is type- and behavior-identical to the Postgres precedent (`packages/3-extensions/postgres/src/runtime/postgres.ts:308-337`) while all transaction lifecycle semantics (commit, rollback, invalidation, connection cleanup) remain owned by the SQL runtime's `withTransaction` — the facade adds zero transaction-lifecycle logic of its own. Write the tests first (repo rule): type tests mirroring `packages/3-extensions/postgres/test/transaction.types.test-d.ts`, facade unit tests mirroring the `transaction()` block of `packages/3-extensions/postgres/test/postgres.test.ts:440-519`.

The spec's chosen design (read it first): `projects/sqlite-mongo-transactions/slices/sqlite-facade-transaction/spec.md` § Chosen design. Key pinned points: context composed as `Object.assign(Object.create(txCtx), { sql: txSql, orm: txOrm })` so the closure-backed `invalidated` getter stays live (spreading `txCtx` is a known footgun — see spec § Pre-investigated edge cases); `tx.orm` executor routes through `txCtx.execute(plan)`; no `raw` on the transaction context; no nested `transaction()` on the context.

## Scope

**In:**

- `packages/3-extensions/sqlite/src/runtime/sqlite.ts` — interface + implementation.
- `packages/3-extensions/sqlite/test/transaction.types.test-d.ts` — new.
- `packages/3-extensions/sqlite/test/transaction.test.ts` — new (reuse the `vi.hoisted` mock pattern from `sqlite-close.test.ts`).
- `packages/3-extensions/sqlite/test/sqlite-close.test.ts` — only if its `@internal/sql-runtime` mock factory needs `withTransaction` added once the facade imports it.

**Out:**

- `test/e2e/framework/**` (dispatch 2).
- `packages/2-sql/5-runtime/**`, `packages/3-targets/**`, `packages/3-extensions/postgres/**` — read as precedent, never modify.
- Docs/READMEs (project milestone 6).

## Completed when

- [ ] New type tests pass: callback return type preserved, `tx.sql` ≡ `db.sql`, `tx.orm` ≡ `db.orm`, `'transaction' extends keyof SqliteTransactionContext` is `false`.
- [ ] New facade unit tests pass: `transaction()` delegates to `withTransaction` with the lazily-created runtime; provides `tx.sql`/`tx.orm`; lazily creates the runtime before `connect()`; rejects with `Error('SQLite client is closed')` after `close()`.
- [ ] Gates green: `cd packages/3-extensions/sqlite && pnpm typecheck` (must cover the test project — if the script is src-only, also run `tsc -p tsconfig.test.json --noEmit`), `pnpm --filter @internal/sqlite test`, `pnpm --filter @internal/sqlite lint`.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up message. Anything that pulls you off the goal — even if it looks useful — halts and surfaces.

## References

- Slice spec: `projects/sqlite-mongo-transactions/slices/sqlite-facade-transaction/spec.md` — chosen design + coherence rationale + slice-DoD.
- Slice plan entry: `projects/sqlite-mongo-transactions/slices/sqlite-facade-transaction/plan.md` § Dispatch 1.
- Calibration entries that apply:
  - `drive/calibration/failure-modes.md` F3 — discover call sites/patterns via grep, not by running the test suite; F14 — gates must mirror CI (lint is a separate CI job; typecheck must cover `test/**`).
  - `drive/calibration/dod.md` § Dispatch-DoD validation gates — per-package invocation forms.
- Repo typesafety rules (CLAUDE.md): no `any`, no bare `as` in production code (`blindCast`/`castAs` if unavoidable — likely unnecessary here; the Postgres precedent's only cast is `Object.create(txCtx) as TransactionContext`, mirror it), no lint suppressions, no import file extensions, test descriptions omit "should".

## Edge cases

| Edge case | Disposition |
| --------- | ----------- |
| Spreading `txCtx` freezes the live `invalidated` getter | Use the `Object.create(txCtx)` prototype pattern per spec |
| `sqlite-close.test.ts` mocks `@internal/sql-runtime` with a factory lacking `withTransaction` | Add it to the mock factory if the import breaks that file |
| Destructive git operations (reset/checkout/clean/stash on shared state) | Forbidden without orchestrator approval (F5) |

## Operational metadata

- **Model tier:** mid (Sonnet) — brief-precise pattern transplant from an established sibling precedent; single package; strong gates.
- **Time-box:** 45 min wall-clock. Overrun → halt and surface, do not extend.
- **Halt conditions:** an out-of-scope surface needs touching to complete the task (other than the named `sqlite-close.test.ts` mock fix); the Postgres pattern does not transplant cleanly (e.g. `withTransaction` or SQLite driver behavior diverges from the spec's assumptions — that's a falsified spec assumption, invariant I12); diff grows beyond the four named files.
- **Affected packages:** `@internal/sqlite` only; no downstream consumers of its types in-workspace gain new obligations (additive public surface). Fixture regeneration: out of scope (`pnpm fixtures:check` untouched — no IR/emitter changes).
- **Commit:** stage the named files explicitly (no `git add -A`), commit on the current branch `tml-2843-sqlite-facade-transaction` with sign-off, message referencing TML-2843.
