# Brief: D4 — root `.aggregate()` honours `distinct()` / `distinctOn()`

## Task

Widen the wrap D3 built so that `distinct` and `distinctOn` also scope the rows a root aggregate reduces. Two edits and their tests:

1. **The condition.** `needsRowScope` becomes `hasPagination || hasDistinct`, where `hasDistinct` is `(state.distinct?.length ?? 0) > 0 || (state.distinctOn?.length ?? 0) > 0`. This is `query-plan-select.ts:1237-1241` verbatim; match it rather than inventing a variant.

2. **The branch inside the inner-select builder**, mirroring `query-plan-select.ts:1315-1355`:
   - `distinctOn` → native `withDistinctOn` over the distinct columns, with the `orderBy` applied when present.
   - `distinct` → `wrapWithRowNumberDedup` (already exported from `query-plan-scope.ts`), then **reapply the `orderBy` on the ranked alias** before `LIMIT` slices it. The dedup wrap strips ordering from its output — Postgres offers no contract that rows exit a `WHERE rn = 1` wrap in any order — so without the reapplication a `distinct` + `orderBy` + `take` chain silently reduces over the wrong rows. This is the whole reason the nested path carries hidden order columns.
   - Hidden order projections (`query-plan-select.ts:1284-1299`) are needed **only** for the `distinct` + `orderBy` combination. `distinctOn` does not need them.

The clause ordering — distinct lowering, then reapplied order, then limit/offset — is not a preference. `test/query-plan-select.test.ts:545` exists because getting it wrong produces a plausible plan that returns the wrong answer.

## Scope

**In:** `src/query-plan-aggregate.ts`, plus unit tests for the new combinations.

**Out:** everything grouped. `src/query-plan-select.ts`'s emitted output. Integration tests (D5). TSDoc (D6). The baseline snapshot.

## Completed when

- [ ] `.distinct(cols).aggregate(...)` compiles to the `ROW_NUMBER` dedup wrap inside the scoped derived table; `.distinctOn(cols).aggregate(...)` compiles to native `DISTINCT ON`.
- [ ] `.distinct(cols).orderBy(...).take(n).aggregate(...)` reduces over the ordered, deduped top-n — with a test that would fail if the `orderBy` were not reapplied after the dedup wrap. A test that passes whether or not the reapplication happens does not satisfy this.
- [ ] `distinct` combined with `take`/`skip` and with `cursor` behaves per the same rules, covered.
- [ ] **The baseline snapshot is byte-unchanged** — verify explicitly and say so.
- [ ] Carried over from D3's review, below the bar for a finding but cheap to close while you are in this function: the `columns.size === 0` branch of `scopedInnerProjection` (every selector lacks a column, under the wrap) is currently only exercised incidentally, with no assertion on the projection shape. Add one — the inner projection is exactly `[__row]` — since you are changing what that projection carries anyway.
- [ ] Validation gates pass.

## Validation gates

- `cd packages/3-extensions/sql-orm-client && pnpm typecheck`
- `pnpm --filter @internal/sql-orm-client test`
- `pnpm --filter @internal/sql-orm-client lint`
- `pnpm fixtures:check`

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note. Anything that pulls you off the goal halts and surfaces.

## Halt conditions

- The baseline snapshot changes.
- The dedup lowering needs a shape `wrapWithRowNumberDedup` does not already provide. Its signature was moved verbatim in D2 and is proven by the nested path; needing to change it means the design is wrong, not the helper. Halt and surface.
- Completing the task requires touching the grouped path.
- 90 minutes wall-clock.

## House rules that apply

- No `any`; no bare `as` in production code. Test files exempt.
- `.agents/rules/no-target-branches.mdc` — the `ROW_NUMBER` lowering is the portable path precisely so no adapter learns a new shape.
- `.agents/rules/omit-should-in-tests.mdc`, `.agents/rules/sql-orm-client-whole-shape-assertions.mdc`, `.agents/rules/no-transient-project-ids-in-code.mdc`.

## References

- Slice spec § Chosen design step 3 — alias naming (`${tableName}__scoped_distinct`) and the clause-order rule.
- Prior art to mirror: `src/query-plan-select.ts:1315-1355`; its test at `test/query-plan-select.test.ts:545` ("reapplies orderBy after the ROW_NUMBER dedup wrap").
- Slice plan § Dispatch 4.

## Operational metadata

- **Model tier:** mid, on the persistent implementer — same rationale as D3 (see slice plan § Model tier, amended after D2). Escalate to a fresh `implementer/thorough` only if D3's review surfaced design weakness.
- **Time-box:** 90 minutes wall-clock.
