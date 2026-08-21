# Dispatch plan — grouped-pagination

**Slice spec:** `projects/aggregate-pagination/slices/grouped-pagination/spec.md`

Five dispatches, sequential. Shorter than slice 1 because the machinery already exists: pre-group scoping is `buildAggregateInput` unchanged, post-group paging is three `SelectAst` methods. What's new is the plumbing that reaches them and the type gate.

## Dispatch 1: `groupBy()` carries the whole state

- **Outcome:** `GroupedCollectionInit` holds the pre-group `CollectionState` instead of `baseFilters`; `groupBy()` passes `this.state`; `compileGroupedAggregate` takes that state and derives its WHERE from it. **No behaviour change** — the emitted plan for every existing grouped chain is identical, because only `filters` was ever read.
- **Builds on:** None.
- **Hands to:** A grouped path that can *see* the pre-group chain, with nothing yet acting on it.
- **Focus:** Plumbing only. Do not make `take`/`skip` do anything yet — that is dispatch 2, and keeping them separate means dispatch 2's diff is purely the behaviour. Every existing grouped test passes unmodified; if one needs an edit, the "no behaviour change" claim is false.

## Dispatch 2: pre-group clauses scope the grouped rows

- **Outcome:** `.take()/.skip()/.cursor()/.distinct()` before `groupBy()` scope the rows that get grouped, by routing through `buildAggregateInput` — the same helper root aggregates use. Group-key columns join what the wrap projects.
- **Builds on:** Dispatch 1's state plumbing.
- **Hands to:** Half the position rule, with the grouped `it.fails` test rewritten and passing.
- **Focus:** The group-key projection is the part that will bite — `GROUP BY posts.user_id` needs `user_id` in the wrap. Slice 1's refactor made the wrap alias back to `tableName`, so references resolve unchanged; do not add a ref-table parameter. Rewrite the grouped `it.fails` case here against the derived-table shape, the way slice 1 rewrote the two root cases.

## Dispatch 3: `GroupedCollection` gains `take`, `skip`, `orderBy`

- **Outcome:** Post-group clauses page the groups themselves — `ORDER BY` / `LIMIT` / `OFFSET` on the grouped select, recorded in a state kept separate from the pre-group one.
- **Builds on:** Dispatch 2's completed pre-group half.
- **Hands to:** Both halves of the position rule, working independently.
- **Focus:** The two states must not merge. A test driving **both** positions in one chain with different values is the one that proves it — `.take(10).groupBy('x').orderBy(…).take(2)`. Also cover both positions with `having()` present, per the project DoD.

## Dispatch 4: the `orderBy` gate on post-group pagination

- **Outcome:** Post-group `take`/`skip` without a prior `orderBy` on the grouped collection is a **compile error**, gated in the type state the way `cursor()` gates on `hasOrderBy`.
- **Builds on:** Dispatch 3's post-group chain.
- **Hands to:** Group paging that cannot be written non-deterministically.
- **Focus:** `GroupedCollection`'s type parameters grow a state flag. Mirror `collection.ts:862-866` rather than inventing a second gating idiom. Assert it with `@ts-expect-error` in a negative type test — a runtime-only check would not satisfy the DoD item, which says "gated in the type state."

## Dispatch 5: integration values on both targets

- **Outcome:** Both grouped positions assert **values** — not plan shape — on PGlite and SQLite, with seed data where the pre-group and post-group answers differ.
- **Builds on:** Dispatch 4.
- **Hands to:** The project-DoD item covering every chain position on both targets.
- **Focus:** Seeds must discriminate: if the same numbers come back whether or not the clause landed in the right position, the test proves nothing. Slice 1's lesson applies directly — the group-key projection gap is exactly the class of defect a shape test misses and a values test catches.

## Validation gates

Per `drive/calibration/dod.md`, threaded into every brief:

- **Always:** `pnpm typecheck`, `pnpm --filter @internal/sql-orm-client lint`.
- **Per dispatch touching source or tests:** `pnpm --filter @internal/sql-orm-client test`.
- **Dispatches 2, 3, 5:** `pnpm --filter integration-tests exec vitest run test/sql-orm-client`.
- **All dispatches:** the baseline snapshot is byte-unchanged. Root `.aggregate()` is slice 1's and must not move.
- **Dispatch 1 specifically:** every existing grouped test passes **unmodified**. That is the whole claim of that dispatch.
- **Before the final push:** sync `origin/main` and re-run. It has moved under this branch three times already.

## Model tier

All five are mid tier. The design is pinned by the spec and the machinery exists; this is plumbing plus a type gate, not design negotiation. Escalate only if a dispatch comes back needing a decision the spec didn't make.
