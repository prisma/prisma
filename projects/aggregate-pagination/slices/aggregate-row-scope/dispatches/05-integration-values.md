# Brief: D5 — integration values on PGlite and SQLite

## Task

Prove the wrap returns the right **numbers** against real databases, on both targets. Everything before this dispatch asserts plan shape; a plan can be structurally perfect and still compute the wrong answer, and a plan that binds parameters correctly on Postgres can desync on SQLite.

Two suites:

1. **PGlite** — extend `test/integration/test/sql-orm-client/aggregate.test.ts`, which already has the harness (`withCollectionRuntime`, `createPostsCollection`, `seedPosts`, `timeouts`).
2. **SQLite** — follow `test/integration/test/sql-orm-client/count-terminal-interleaving.test.ts`, which composes a SQLite runtime in-test with `defineContract` from `@internal/sqlite/contract-builder` plus the sqlite adapter/driver/target. **Do not emit a new fixture**; `defineContract` is a user-facing authoring surface, so `.agents/rules/no-contract-data-patching-in-tests.mdc` is satisfied.

## What the values must prove

Seed a row set where the paginated answer and the unpaginated answer **differ**. A test that passes whether or not the wrap is applied proves nothing — this is the acceptance bar for every case below.

Per target:

- `.orderBy(...).take(n).aggregate(sum)` — the sum of the top n, not the sum of all.
- `.skip(n)` without `take` — reduces over all-but-the-first-n.
- `.where(...)` combined with pagination — the filter applies inside the scope, and the answer reflects both.
- `.distinct(...)` (and `distinctOn` where the target supports it) with an aggregate — assuming D4 has landed; if the target has no `DISTINCT ON`, cover only what it supports and say so in your report.
- **The parameter-binding case.** A chain whose WHERE carries at least two distinct bound values *and* pagination, so the plan crosses the derived-table boundary with parameters present. On SQLite this is the case that would break if a `ParamRef` instance reached SQL twice: the renderer emits one `?` per occurrence and does not dedupe, while `plan.params` is deduped by identity — a desync shifts every subsequent binding and the query either errors or silently answers with the wrong values. Assert the returned numbers, not just that the query ran.

## One hardening addition — a blind spot next door

**No self-relation test anywhere uses `distinct`, `take`, or `skip`** — zero hits across `test/self-relations.test.ts` and `test/integration/test/sql-orm-client/self-relations-matrix.test.ts`. So the `__ranked` / `__distinct` ladder at self-relation depth is entirely unexercised, and that is the one place where two same-named hidden-order aliases at different depths actually meet `wrapWithRowNumberDedup`'s forward-every-alias behaviour (`query-plan-scope.ts:216-218`).

Adversarial review walked that path statically and found it sound — nested scopes plus universally table-qualified references mean the identical names never share a scope — but that confidence rests on reading, not execution.

**Add `.distinct('name')` to both levels of the existing two-deep test at `self-relations-matrix.test.ts:78-97`.** It reuses the seeded graph and the existing assertion shape, and routes an already-covered chain through the ladder.

This is **hardening, not a defect fix**: nothing predicts it will fail, and nothing in this slice depends on it. It is here because the slice generalised that alias scheme to root position, and leaving its riskiest shipped configuration unexecuted while doing so would be a poor trade for one line. If it *does* fail, that is a pre-existing nested-path defect — halt and report; do not fix it here, since the project forbids moving that path's output.

## Scope

**In:** `test/integration/test/sql-orm-client/aggregate.test.ts`; a new SQLite integration test file alongside it.

**Out:** `packages/**` — no source changes in this dispatch. If a value comes back wrong, that is a finding for the orchestrator, not something to fix here: a wrong number means D3 or D4 has a defect, and the fix belongs in a dispatch that owns that code with the reviewer looking at it.

## Completed when

- [ ] Every case above asserts concrete values on PGlite, and on SQLite for the operations SQLite supports.
- [ ] At least one case per target would fail if the wrap were removed — state in your report which case that is and why it discriminates.
- [ ] The parameter-binding case passes on both targets with asserted values.
- [ ] `pnpm test:integration` green.
- [ ] The baseline snapshot is byte-unchanged.

## Validation gates

- `pnpm test:integration` (or the narrowest invocation covering `test/sql-orm-client/**` — name what you ran)
- `cd packages/3-extensions/sql-orm-client && pnpm typecheck`
- `pnpm --filter @internal/sql-orm-client lint`

## Standing instruction

Stay focused on the goal; control scope. Anything that pulls you off the goal halts and surfaces.

## Halt conditions

- **A value comes back wrong.** Halt immediately and report the chain, the expected number, the actual number, and the emitted SQL. Do not adjust the expectation to match the output, and do not fix the source — this dispatch is read-only on `packages/**`.
- **Exception — one failure is predicted and is this dispatch's job to adjudicate.** `skip` without `take` on SQLite is expected to fail with a syntax error near `OFFSET`: SQLite's grammar is `LIMIT expr [OFFSET expr]` with no standalone `OFFSET`, while `packages/3-targets/6-adapters/sqlite/src/core/adapter.ts:254-255` renders the two as independently-omittable clauses. If that is what you observe, you have **confirmed a prediction, not hit an obstacle**: record the exact error text and the emitted SQL, leave the case in place (skipped or marked as the known gap, your call — say which), and carry on with every other case. A separate authorised dispatch fixes the renderer. If instead it *passes*, say so just as clearly — refuting the prediction is equally valuable and cancels that dispatch.
- SQLite cannot express a case (e.g. no `DISTINCT ON`). Report what you covered and what the target cannot support; do not silently drop it.
- 90 minutes wall-clock.

## House rules that apply

- `.agents/rules/test-database-limitations.mdc`, `.agents/rules/use-timeouts-helper-in-tests.mdc` (use the shared `timeouts` helpers, not raw numbers), `.agents/rules/typed-contract-in-tests.mdc`.
- `.agents/rules/omit-should-in-tests.mdc`, `.agents/rules/no-transient-project-ids-in-code.mdc`.

## References

- Project spec § Cross-cutting requirements — "Parameter binding stays correct across the derived-table boundary… Every slice emitting a wrap carries a per-target test." This dispatch is that test.
- Slice spec § Pre-investigated edge cases — the `ParamRef` trap and the SQLite-harness note, both with citations.
- `packages/2-sql/4-lanes/relational-core/src/ast/util.ts` — `collectOrderedParamRefs` and the comment explaining why the SQLite renderer deliberately does not use it.

## Operational metadata

- **Model tier:** mid — brief-precise, strong gates.
- **Time-box:** 90 minutes wall-clock.
