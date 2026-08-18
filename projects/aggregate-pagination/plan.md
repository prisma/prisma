# aggregate-pagination — Plan

**Spec:** `projects/aggregate-pagination/spec.md`
**Linear Project:** _None. This project is tracked in-repo only — the spec, this plan, and the slice PRs are the record._

## At a glance

Two slices, delivered in order. The first builds one piece of shared machinery — given a chain, work out which rows the query is actually talking about — and makes plain `.aggregate()` use it. The second makes `.groupBy()` use the same machinery, and adds paging over groups.

The work is split by what the code does, not by which method the user called. That matters: splitting it per-method leaves combinations like `.distinct('title').groupBy('userId')` belonging to no slice. Sharing one row-scope builder means every combination is covered by construction.

## Composition

### Stack (deliver in order)

1. **Slice `aggregate-row-scope`** — **delivered 2026-08-18: [PR #30067](https://github.com/prisma/prisma/pull/30067)**, awaiting review
   - **Outcome:** One shared helper answers "which rows does this chain describe?" — honouring `take`, `skip`, `cursor`, `distinct`, and `distinctOn` — and root `.aggregate()` reduces over exactly those rows. When a chain has none of those clauses, the compiled SQL is byte-identical to today's, enforced by a CI guard rather than by review. `skip` without a paired `take` works.
   - **Builds on:** None.
   - **Hands to:** The row-scope helper itself, plus the supporting module (`src/query-plan-scope.ts`) holding the pieces lifted out of `query-plan-select.ts`, plus `compileAggregate`'s reworked signature, which receives the collection's full state instead of just its filters. `compileGroupedAggregate` keeps its `filters` parameter until slice 2: `GroupedCollection` carries `baseFilters`, not a state, so handing the grouped compile a scope it ignores would ship the exact shape this project exists to remove. Operator-confirmed 2026-08-17.
   - **Focus:** Root `.aggregate()` only. Anything involving `groupBy()` is slice 2. The helper extraction lands as its own dispatch, before any behaviour change builds on it — the spec requires that separation. The existing `test/aggregate-pagination.test.ts` is rewritten against the real compiled shape here; it is never flipped from `it.fails` as-is, because its current assertions describe an outcome nobody wants.

2. **Slice `grouped-pagination`** — tracked by its PR
   - **Outcome:** `.groupBy()` stops discarding what preceded it. Clauses before `groupBy()` shape the rows that get grouped — including `distinct`, which comes free from slice 1's helper. Clauses after `groupBy()` page the groups themselves, and require a prior `orderBy` on the grouped collection, enforced in the type system. Both behaviours verified with `having()` in play.
   - **Builds on:** Slice 1's row-scope helper and `compileAggregate`'s reworked signature. Reworking `compileGroupedAggregate`'s signature is slice 2's own first move, alongside the state `groupBy()` starts carrying into `GroupedCollection`.
   - **Focus:** Everything grouped. `GroupedCollection` gains `take`, `skip`, and `orderBy` under those plain names — the object already represents groups, so the names need no suffix. Ordering groups by an aggregate value (Prisma's `orderBy: { _sum: … }`) is a project non-goal and stays out.

## Dependencies (external)

None. Tracker linkage is deliberately absent: the operator decided on 2026-08-17 that this project runs without a Linear Project, so the DoR items and close-out steps that assume tracker issues do not apply. Each slice is tracked by its PR.

## Sequencing rationale

**Why two slices and not three.** An earlier draft split the work three ways: pagination for `.aggregate()`, `distinct` for `.aggregate()`, pagination for `.groupBy()`. That split left `distinct` + `groupBy` owned by nobody — a broken case that survived the project. The hole was an artifact of splitting per-method. Root `.aggregate()` is really the grouped case with no group keys, and both need the same "which rows" answer first, so one shared helper removes the hole instead of adding a fourth slice to patch it.

**Why they are sequential rather than parallel.** Slice 2 consumes slice 1's helper directly. There is no useful parallelism to recover here — the earlier draft's parallel pair only existed because the wrong split created two independent-looking halves of one job.

**Why the CI guard lands in slice 1.** It protects the project's hardest requirement: adding pagination support must cost unpaginated queries nothing. Putting it in with the helper means slice 2 fails CI immediately if it widens the wrap condition too far — the regression a reviewer reading a `groupBy` diff would be least likely to spot.

**The size risk on slice 1, and the fallback.** Slice 1 carries the extraction, the helper, the wrap, four clause families, and the CI guard. It is the larger of the two and the one to watch when it is decomposed into dispatches. If it will not fit a single review, the clean cut is to move `cursor` and `distinct` into a follow-on slice — the helper is built once either way, so nothing is thrown away. Do not cut it by splitting root from grouped; that reintroduces the hole this plan exists to avoid.
