# Brief: D1 R2 — resolve F1 (cast ratchet)

Resume of D1. Carry-over from the R1 review (`projects/sqlite-mongo-transactions/reviews/code-review.md` § F1):

## Task

Resolve finding **F1 (should-fix)**: `packages/3-extensions/sqlite/src/runtime/sqlite.ts:280` uses a bare `as` cast (`Object.create(txCtx) as TransactionContext`), which increments the `no-bare-cast` ratchet (`scripts/lint-casts.mjs` counts HEAD vs merge-base) and would fail CI. Replace with `castAs<TransactionContext>(Object.create(txCtx))` from `@internal/utils/casts` (the value satisfies the target type through its prototype chain — `castAs` is the declarative-widening helper for exactly this case). Add the import; no other changes.

## Completed when

- [ ] No bare `as` cast remains in the D1 diff (`git diff origin/main..HEAD -- packages | grep -E '^\+.* as ' ` shows only `as const`/type-import lines, if any).
- [ ] Cast ratchet green: run the ratchet the way CI does (see `scripts/lint-casts.mjs` / its package script) and confirm zero delta vs merge-base.
- [ ] Re-run the D1 gates: package typecheck, `pnpm --filter @internal/sqlite test`, `pnpm --filter @internal/sqlite lint` — green.
- [ ] New commit (no amend), explicit staging, sign-off, message referencing TML-2843.

## Standing instruction

Unchanged. Scope is this one fix; anything else halts and surfaces.

## Operational metadata

- **Model tier:** mid (Sonnet). **Time-box:** 15 min.
