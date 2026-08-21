# Slice 2 PR — draft

**Title:** `Fix: groupBy() ignored the chain before it, and couldn't page the groups after it`

---

`groupBy()` forwarded exactly one thing from the collection it was called on — the `where` filters. Everything else you had chained before it (`take`, `skip`, `cursor`, `distinct`, `orderBy`) was dropped on the floor with no error, and there was no way to page the groups it produced. Both halves silently returned confident wrong answers. This is the second and final slice of the aggregate-pagination project; the first fixed the same defect at the root `aggregate()` position.

Position now decides meaning:

```typescript
// BEFORE groupBy → scope which rows get grouped
db.orm.Post.orderBy((p) => p.views.desc()).take(10).groupBy('userId').aggregate(…)
// SELECT user_id, sum(views) FROM (SELECT … ORDER BY views DESC LIMIT 10) posts GROUP BY user_id

// AFTER groupBy → page the groups themselves
db.orm.Post.groupBy('userId').orderBy((g) => g.userId.desc()).take(10).aggregate(…)
// SELECT user_id, sum(views) FROM posts GROUP BY user_id ORDER BY user_id DESC LIMIT 10
```

## Changes

- **`groupBy()` carries the whole chain** (`collection.ts`, `grouped-collection.ts`). `GroupedCollectionInit` holds the full `CollectionState` instead of just `baseFilters`. Landed as its own commit with zero behaviour change — every existing grouped test passed unmodified, which was the claim that made the next commit's diff purely behaviour.

- **Pre-group clauses scope the grouped rows** (`query-plan-aggregate.ts`). Routes through `buildAggregateInput`, the same helper root aggregates use — no second mechanism. Group-key columns join what the wrap projects, or `GROUP BY posts.user_id` resolves against nothing.

- **`GroupedCollection` gained `take` / `skip` / `orderBy`.** These page the groups, and record a `GroupPagingState` kept deliberately separate from the pre-group `CollectionState`. Conflating the two is the exact bug this slice exists to prevent, so there is a test driving both positions in one chain with different values (`take(10)` before, `take(2)` after) asserting each lands at its own level.

- **Post-group `take` / `skip` require a prior post-group `orderBy`**, gated in the type state the way root `cursor()` gates on `hasOrderBy` — the parameter narrows to `never`. Unordered group paging is non-deterministic, so "page 2" would be meaningless. Asserted in both directions: the unordered form fails, the ordered form still compiles.

- **MTI variant joins on grouped aggregates** — a pre-existing bug, not a regression from this work. `compileGroupedAggregate` never resolved polymorphism info at any commit in its history, so `.variant('Feature').groupBy(…)` dropped the variant join and aggregated over the wrong rows. Fixed here because this PR already rewrites that function, with three tests: wrapped, unwrapped, and an STI negative control proving no join is added where none is needed. The unwrapped case is what establishes it was never wrap-specific.

- **Docs + release note.** A new ORM chaining guide under `docs/reference/`, and an rc.5 release-note entry covering *both* slices' breaking changes — someone upgrading from rc.4 gets both at once and doesn't care which slice moved their numbers.

## Why

**Position rather than a new method name.** A user arriving from Prisma writes `.take(10).groupBy('x')` and expects group-paging; someone thinking in SQL writes it expecting row-scoping. Both readings are legitimate, which is why the old silent-drop was so damaging — it satisfied neither and signalled nothing. Making position decide means both users can express what they meant, and the project spec treats shipping only one half as relocating the bug rather than closing it.

**Two states, not one merged state.** The pre-group and post-group clauses are different clauses at different levels. Merging them into one field would make `.take(10).groupBy('x').take(2)` ambiguous at exactly the point where the user was most explicit about what they wanted.

**Values, not plan shape.** Slice 1's lesson, applied directly: a shape test would have missed the group-key projection gap entirely. Every integration case here seeds data where the right and wrong answers *differ* — the strongest is a SQLite case where correct scoping removes a user from the result set altogether rather than merely changing their count.

**Reused machinery over new machinery.** Pre-group scoping is slice 1's `buildAggregateInput` unchanged; post-group paging is three existing `SelectAst` methods. The derived table aliases back to the original table name so outer references resolve without rewriting column refs.

## Verification

- Unpaginated aggregates compile byte-identically to before — the committed baseline AST snapshot is unchanged across every commit in this PR, which is the CI-enforced guard the project required.
- `test/aggregate-pagination.test.ts` contains no `it.fails`, closing the project-DoD item slice 1 could not.
- Integration values on both PGlite and SQLite, for both positions and for both in one chain.
- Manual QA script + run report under the project directory.

## Notes for the reviewer

- **A known bug is deliberately not fixed here.** Manual QA found that `ORDER BY` on a Postgres enum column loses declaration order behind *any* derived table, falling back to a plain text sort — so post-group `orderBy()` on an enum group key can return a different group, silently. It is **pre-existing and wider than this PR**: `collectTableSources` in the Postgres renderer skips non-`table-source` FROM sources by design, with a comment saying so, which means `.distinct().orderBy(enumCol)` on the plain-select path and `DISTINCT ON` have had the same defect since `wrapWithRowNumberDedup` first aliased a derived table back to its base name. SQLite is unaffected — it never attempts declaration-order enum sorting. The fix belongs in the Postgres adapter with its own tests across `ORDER BY`, `DISTINCT ON`, and nested wraps, and ships in a separate PR before rc.5 is cut, so no released version exposes the new route unfixed.
- The MTI fix is a genuine drive-by. It is separable and can be pulled into its own PR if you'd rather review it apart from the pagination work.
- TSDoc was deliberately *not* added for the position rule. The prose lives in the new docs guide, where a user reads before writing the chain, rather than in a hover they see after. Recorded as a decision in the project spec.
