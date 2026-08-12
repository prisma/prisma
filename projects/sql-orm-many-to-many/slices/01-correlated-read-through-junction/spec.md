# Slice 1: correlated include read through the junction

_Parent project: `projects/sql-orm-many-to-many/`. Outcome this slice contributes: `include('tags')` returns `tags: Tag[]` for an M:N relation in one correlated query._

## At a glance

Slice 0 made `ResolvedRelation.through` available. This slice teaches the read path to walk it: `db.orm.User.include('tags')` resolves an M:N relation to `{ …user, tags: Tag[] }` in a **single** SQL execution — one correlated subquery that hops parent → junction → target, no LATERAL, no multi-query. It also lands the first M:N **integration** coverage (and the M:N fixture the later slices reuse).

## Chosen design

**Carry `through` onto `IncludeExpr`, branch in the correlated projection builder.**

- `resolveIncludeRelation` (`collection-contract.ts`) surfaces the slice-0 `through` descriptor onto the resolved include relation; `IncludeExpr` (`types.ts`) gains an optional `through?` mirroring it.
- `buildCorrelatedIncludeProjection` (`query-plan-select.ts`): today it correlates `child.targetColumn = parent.localColumn` directly. When `include.through` is present, the correlated subquery instead selects from the **target** joined to the **junction** (`junction.childColumns = target.targetColumns`), correlated to the parent on `junction.parentColumns = parent`'s anchor — i.e. the target rows are those whose PK appears in the junction rows pointing at this parent. Child rows aggregate under the relation key exactly as the FK case does; the outer query stays one execution.

```ts
// FK case (today):           target WHERE target.fk = parent.pk
// M:N case (this slice):     target JOIN junction ON junction.child = target.pk
//                                   WHERE junction.parent = parent.pk
```

**Integration tests + fixture.** The integration fixture (`test/integration/test/sql-orm-client/…`, PGlite via `withCollectionRuntime`) has no M:N relation today. This slice adds one to the fixture source — **User ↔ Tag** via a `UserTag` junction (`userId`, `tagId`) — and re-emits `contract.json` + `contract.d.ts`. Tests follow the project's **integration-test standard** (below).

## Coherence rationale

One reviewable story: "the include path reads an M:N relation through its junction, proven end-to-end on the database." The `IncludeExpr.through` plumbing, the projection-builder branch, the fixture M:N relation, and the integration tests are inseparable — the tests can't run without the fixture, and the plumbing is only meaningful once a query exercises it.

## Scope

**In:** `resolveIncludeRelation` + `IncludeExpr.through` (`collection-contract.ts`, `types.ts`); the M:N branch in `buildCorrelatedIncludeProjection` (`query-plan-select.ts`) and whatever decode/grafting the include child path needs to assemble `tags: Tag[]`; the integration fixture M:N relation + re-emit; M:N include integration tests.

**Out:** filter EXISTS (slice 2); nested write (slice 3); any `IncludeExpr` change beyond carrying `through`; non-correlated strategies.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
|---|---|---|
| Composite-key junctions | `through.parentColumns`/`childColumns`/`targetColumns` are arrays — the correlation must AND across all column pairs, never assume a single column | Slice 0 surfaces arrays |
| Single SQL execution | A test must assert the M:N include resolves in **one** execution with **no `LATERAL`** keyword — pins the correlated-only intent (per TML-2729) | The repo dropped LATERAL/ multi-query; don't reintroduce |
| `fixtures:check` emit env limitation | Local `fixtures:emit` fails on a pre-existing CLI-on-PATH issue in this sandbox; verify the re-emitted fixture by inspecting the generated `contract.json` diff + rely on CI for the gate | Known from slice 0 / TML-2729 |

## Slice-specific done conditions

- [ ] `db.orm.User.include('tags')` returns `{ …user, tags: Tag[] }` for the M:N relation, asserted as a **whole row** (`toEqual`), in a **single** SQL execution (no `LATERAL`).
- [ ] Integration tests follow the standard: most use explicit `.select(...)` (whole-selected-row `toEqual`); **at least one** exercises implicit/default selection for the nested M:N read (full default `Tag` shape returns without an explicit select). Depth-2 nesting through the junction covered.
- [ ] The integration fixture defines an M:N relation (User↔Tag via `UserTag`) and the re-emitted `contract.json`/`contract.d.ts` are committed; `fixtures:check` reconciles (or the emit-env limitation is noted and additivity shown via diff).

## Open Questions

1. **Fixture M:N shape.** Working position: **User ↔ Tag** via an explicit `UserTag` junction model (`userId`, `tagId`, composite PK), no payload columns — the canonical pure-junction case. A second fixture relation with a composite or payload junction can be added if a test needs it, but the simple case is the baseline.

## References

- Parent project: `projects/sql-orm-many-to-many/spec.md` (§ Cross-cutting requirements — the integration-test standard).
- Slice 0: `../00-contract-resolver-foundation/spec.md` — the `ResolvedRelation.through` this builds on.
- Linear issue: [TML-2785](https://linear.app/prisma-company/issue/TML-2785)
