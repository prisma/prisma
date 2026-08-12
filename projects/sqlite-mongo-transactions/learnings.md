# Project learnings — sqlite-mongo-transactions

Working ledger of patterns surfaced during this run. Reviewed at close-out; cross-cutting lessons migrate to durable docs, project-local ones drop with the folder.

## D1 (sqlite facade transaction)

- **Stale-workspace false alarm after branch rebase.** Cutting a branch from a newer `origin/main` without re-running `pnpm install` + `pnpm build` produced 5 test failures + typecheck errors in `@internal/sqlite` that looked like a red main (blamed on TML-2837). A rebuild made all gates green. Candidate durable home: a line in the worktree/branching docs or `drive/calibration/failure-modes.md` ("verify-stale-build before believing a pre-existing-red claim — run install+build first").
- **"Mirror the precedent" briefs can authorize rule violations.** The D1 brief authorized mirroring the Postgres facade's bare `as TransactionContext` cast; the reviewer caught that the `lint:casts` ratchet counts per-PR increases, so the mirrored cast would fail CI even though the precedent file carries it in the baseline. Brief-authoring lesson: precedent-transplant briefs must say "mirror the pattern, but apply current repo rules where the precedent predates them."
- **Pre-existing cleanup candidate (out of slice scope):** two old bare casts at `packages/3-extensions/sqlite/src/runtime/sqlite.ts:99-100` (plus 3 aliased-import false positives from the biome plugin). Possible tiny follow-up ticket; not a finding.

## Examples (post-slice scope expansion)

- **An example must demonstrate why a primitive exists, not just that it works.** The first transaction demo (create user + N posts atomically) was a textbook single nested-write — it exercised `db.transaction()` but taught the anti-pattern of reaching for a transaction when one statement suffices. Reviewer (repo owner) rejected it: examples are training data for users AND AI agents, so a contrived example actively propagates bad patterns. Redesigned as a per-user post quota (read count → app-decision → conditional insert): an interactive transaction is genuinely necessary because the check-then-act must be atomic against TOCTOU. Add-on requirement: use ORM and SQL-builder lanes where each is genuinely warranted (SQL builder for the aggregate COUNT, ORM for the typed entity create) — not just "both appear." Directly relevant to the Mongo slices' examples/e2e: pick scenarios where the transaction is load-bearing.

- **Codec branding is target-asymmetric.** Postgres codecs brand row scalar types (opaque UUID/datetime brands); SQLite codecs map to plain `string`/`Date`. The transaction-demo implementer cargo-culted `blindCast` calls from `orm-client/create-user.ts` and invented a brand rationale; in the SQLite demo they were no-ops (removed in `e16e4a973`). The `create-user.ts` casts themselves are NOT vestigial — they keep the file symmetric with its Postgres-demo twin where the brand is real (operator clarification). Relevance for Mongo slices: check what the Mongo codecs brand before writing example/e2e input literals; don't assume either target's behavior.

## PR review iteration (post-slice)

- **Async-generator suspension semantics fooled implementer AND reviewer.** D3 placed the `invalidated` check inside the `for await` body *before* `yield` — but `for await` pulls from the inner iterator (driver call!) *before* the body runs, so a partially-consumed escaped iterator still hit the raw driver error on resume. The agent review round verified "check at entry + in loop" as correct; the human reviewer caught that the in-loop check sits on the wrong side of the `yield` (the resumption point). Lesson: guards around `yield` must be reasoned about per *resumption point*, not per loop iteration; tests must cover the partially-consumed case, not just consume-from-scratch. Candidate durable home: `drive/calibration/failure-modes.md` (boundary-property test that doesn't discriminate — F13 family) and/or a typescript-patterns note on generator guard placement.

## D2 (e2e proof)

- **Postgres-only validation masked a guard gap in shared runtime code.** `withTransaction`'s escaped-result invalidation guard was only ever exercised against drivers that keep the connection alive after commit (Postgres/PGlite); SQLite's connection-closing driver bypassed it entirely. Lesson for the Mongo slices: behavioral invariants claimed by shared runtime helpers need per-driver e2e proof, not inherited trust — exactly what this slice's D2 was for, and it caught one. Candidate durable home: `drive/calibration/failure-modes.md` (variant of F13).
