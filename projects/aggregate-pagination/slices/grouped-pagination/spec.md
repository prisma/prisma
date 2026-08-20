# Slice: grouped-pagination

Parent project: `projects/aggregate-pagination/`. Outcome this slice contributes: `groupBy()` stops discarding the chain that precedes it, and gains a chain of its own that pages the groups — closing the half of the position-semantics rule slice 1 left open.

## At a glance

`groupBy()` currently forwards exactly one thing from the collection it was called on:

```ts
baseFilters: this.state.filters,   // collection.ts, inside groupBy()
```

Everything else — `take`, `skip`, `cursor`, `distinct`, `orderBy` — is dropped on the floor, silently, which is the same defect slice 1 fixed at the root position. This slice makes **position decide meaning**:

```typescript
// BEFORE groupBy → scope the rows, then group them
db.orm.Post.orderBy((p) => p.views.desc()).take(10).groupBy('userId').aggregate(…)
// SELECT user_id, sum(views) FROM (SELECT … ORDER BY views DESC LIMIT 10) posts GROUP BY user_id

// AFTER groupBy → page the groups themselves
db.orm.Post.groupBy('userId').orderBy(…).take(10).aggregate(…)
// SELECT user_id, sum(views) FROM posts GROUP BY user_id ORDER BY … LIMIT 10
```

Neither shape is new. Pre-group scoping is slice 1's `buildAggregateInput`, unchanged. Post-group paging is `SelectAst.withOrderBy` / `withLimit` / `withOffset` applied to the select `compileGroupedAggregate` already builds.

## Chosen design

### 1. `groupBy()` carries the whole state

`GroupedCollectionInit.baseFilters: readonly AnyExpression[]` becomes the full `CollectionState`. `groupBy()` passes `this.state` instead of `this.state.filters`.

That single change is what makes pre-group clauses reachable; everything downstream reads them through slice 1's helper.

### 2. `GroupedCollection` gains its own chain

`take`, `skip`, `orderBy` — under those plain names, since the object already represents groups and needs no suffix. They record a **separate** post-group state, never merged with the pre-group one. The two are different clauses at different levels and conflating them is the bug this slice exists to prevent.

`having()` is unchanged.

### 3. `compileGroupedAggregate` takes both

Signature moves from `filters: readonly AnyExpression[]` to the pre-group `CollectionState` plus the post-group clauses. Pre-group scoping delegates to **`buildAggregateInput`** — the same helper root aggregates use, with the group-key columns added to what it projects (see edge cases). Post-group clauses apply to the grouped select itself.

Slice 1 deliberately left this signature alone; this is where it changes, alongside the behaviour that consumes it.

### 4. Post-group `take`/`skip` require a prior `orderBy`

Gated in the type state, the way `cursor()` gates on `hasOrderBy` (`collection.ts:862-866`): the parameter narrows to `never` without one. `GroupedCollection`'s type parameters grow a state flag to carry it.

Unordered group paging is non-deterministic — the database may return groups in any order, so "page 2" is meaningless. Prisma requires the same pairing.

## Coherence rationale

One reviewer holds one question: *what does a clause mean on either side of `groupBy()`?* The pre-group and post-group halves are the two answers to it, and shipping either alone leaves the rule half-true — a user migrating from Prisma writes `.take(10).groupBy('x')` expecting group-paging, so shipping only row-scoping relocates the silent-wrong-answer bug rather than closing it. The project spec names that explicitly as a transitional-shape constraint.

## Scope

**In:** `src/collection.ts` (`groupBy()` passing state), `src/grouped-collection.ts` (the post-group chain, the type gate), `src/query-plan-aggregate.ts` (`compileGroupedAggregate`), `src/query-plan-source.ts` (group-key columns in `buildAggregateInput`), the grouped `it.fails` test, unit tests for both positions, integration values on both targets.

**Out:** Ordering groups by an aggregate alias (`orderBy: { _sum: … }`) — a project non-goal needing a new builder surface over the aliases. `cursor()` on the grouped collection — a project non-goal; cursor stays pre-group. Root `.aggregate()` — slice 1 closed it and its compiled output must not move. The nested `include(...)` path. Mongo.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| `buildAggregateInput` doesn't project group-key columns | Extend it | It currently projects the columns aggregate selectors name plus `orderBy` columns. A grouped query also needs the **group keys** in the wrap, or `GROUP BY posts.user_id` resolves against nothing. This is the same class as the `orderBy`-column gap the integration suite caught during slice 1's refactor — and the unit suite missed then, so cover it with a values test, not a shape test. |
| The wrap aliases back to `tableName` | Relied on, don't change | Slice 1's refactor made the derived table alias `posts`, not `posts__scoped`, precisely so outer references resolve unchanged. `GROUP BY posts.user_id` and `sum(posts.views)` both depend on that. If you find yourself adding a ref-table parameter, stop — that was removed for a reason. |
| Pre-group and post-group state merged by accident | The defect to guard against | They are separate fields with separate meanings. A test where **both** are present and different — `.take(10).groupBy('x').orderBy(…).take(2)` — is the one that catches a merge. |
| `having()` interacts with both positions | Cover explicitly | Project DoD requires both behaviours verified with `having()` present. `having()` filters groups, so it applies after grouping and before post-group paging. |

## Slice-specific done conditions

- [ ] The grouped `it.fails` case in `test/aggregate-pagination.test.ts` is rewritten and passing — **the file contains no `it.fails` at all afterwards**, which closes the project-DoD item slice 1 could not.
- [ ] A test drives pre-group and post-group pagination **in the same chain**, with different values, and asserts both land in the right place.
- [ ] Post-group `take`/`skip` without a prior `orderBy` is a compile error, asserted with `@ts-expect-error` in a negative type test.
- [ ] Integration tests assert **values** on both PGlite and SQLite for both grouped positions, with seed data where the two answers differ.
- [ ] Root `.aggregate()`'s compiled output is unchanged — the baseline snapshot still holds.

## Open Questions

1. **Does `GroupedCollection` need a `cursor()` too?** Working position: **no** — the project spec makes it an explicit non-goal, since Prisma doesn't offer one on `groupBy` and a lexicographic boundary over group keys is a separate design. Raised only because a reader may expect symmetry with the root chain.

## References

- Parent project: `projects/aggregate-pagination/spec.md`, `plan.md`
- Slice 1: `../aggregate-row-scope/spec.md` and its PR — the row-scope helper, the alias convention, and the position-semantics rule this slice completes
- ADR 201 — State-machine pattern for typed DSL builders: `GroupedCollection` gaining its own menu of methods is the pattern, not an exception to it
