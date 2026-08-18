# Slice: aggregate-row-scope

Parent project: `projects/aggregate-pagination/`. Outcome this slice contributes: root `.aggregate()` reduces over exactly the rows the chain describes, and the machinery that answers "which rows?" exists in one place for `groupBy()` to reuse.

## At a glance

`db.orm.Post.orderBy(…).take(10).aggregate(…)` stops reducing over every matching row. The row-scoping wrap that `include('posts', (p) => p.skip(5).take(10).count())` already compiles to gets lifted out of `query-plan-select.ts` into `src/query-plan-scope.ts` and reused from `compileAggregate`. A chain that names no scope compiles byte-identically to today — proved by a characterization snapshot generated on pre-change code, not by review.

## Chosen design

Three moves, in this order. The first has no behaviour delta; the third is where behaviour changes.

### 1. Lift the row-scope machinery into `src/query-plan-scope.ts`

Move-only, no logic edits:

| Moves | From |
| --- | --- |
| `createTableRefRemapper` | `query-plan-select.ts:311` |
| `buildStateWhere` | `query-plan-select.ts:331` |
| the cursor lowering it calls (`buildCursorWhere`, `createBoundaryExpr`, `buildLexicographicCursorWhere`) | `query-plan-select.ts:~230-309` |
| `wrapWithRowNumberDedup` | `query-plan-select.ts:417` |

`query-plan-select.ts` imports them back; its emitted output does not move. `query-plan-mutations.ts:175` carries its own private `createTableRefRemapper` — leave it alone, unifying it is a different change with different reviewers.

### 2. `compileAggregate` receives the collection's state

```typescript
// before — query-plan-aggregate.ts:180
export function compileAggregate(
  contract, aggregates, namespaceId, tableName,
  filters: readonly AnyExpression[],
  aggregateSpec,
): SqlQueryPlan<Record<string, unknown>>

// after
export function compileAggregate(
  contract, aggregates, namespaceId, tableName,
  state: CollectionState,
  aggregateSpec,
): SqlQueryPlan<Record<string, unknown>>
```

Call sites: `collection.ts:1139` (passes `this.state` instead of `this.state.filters`), `test/query-plan-aggregate.test.ts`, and any aggregate case in `test/rich-query-plans.test.ts`.

`compileGroupedAggregate` keeps its `filters` parameter in this slice — operator-confirmed 2026-08-17, and the project plan was amended to match. `GroupedCollection` carries `baseFilters`, not a state (`grouped-collection.ts:39-46`); handing the grouped compile a scope it ignores would ship exactly the silent-discarded-scope shape this project exists to remove. Slice 2 changes that signature alongside the behaviour that consumes it.

### 3. The conditional wrap in `compileAggregate`

Mirrors the nested prior art's rule verbatim (`query-plan-select.ts:1237-1241`):

```typescript
const needsRowScope = hasPagination || hasDistinct;  // limit/offset, or distinct/distinctOn
```

`cursor` is not in that condition — it lowers to a WHERE boundary that `buildStateWhere` already folds in, wrap or no wrap, exactly as the nested path does. A bare `orderBy` with no pagination and no distinct stays inert and dropped, which is both today's behaviour and the house style (`test/query-plan-select.test.ts:486`).

When `needsRowScope` is false, the emitted plan is what `compileAggregate` emits today, constructed by the same code path — not a re-derivation that happens to match.

When it is true:

```sql
SELECT sum(posts__scoped.views) AS totalViews
FROM (
  SELECT posts.views AS views
  FROM posts
  WHERE …            -- state filters + cursor boundary
  ORDER BY …
  LIMIT 10 OFFSET 5
) posts__scoped
```

- **Aliases:** `${tableName}__scoped`, and `${tableName}__scoped_distinct` for the `ROW_NUMBER` wrap — following `${relationName}__scalar` / `__scalar_distinct` at `query-plan-select.ts:1283,1328`.
- **Inner projection:** one item per distinct `selector.column` across the aggregate spec, plus `ProjectionItem.of('__row', LiteralExpr.of(1))` when any selector has no column (`count()`), plus the hidden order columns the `distinct` + `orderBy` combination needs (`query-plan-select.ts:1284-1299`).
- **Clause order inside the wrap:** `distinctOn` → native `withDistinctOn`; `distinct` → `wrapWithRowNumberDedup` then reapply `orderBy` on the ranked alias; then `LIMIT` / `OFFSET`. This is `query-plan-select.ts:1315-1355`, which already proves the ordering is the one that gives the right answer.
- **Outer aggregates read the alias:** `toAggregateProjection` currently resolves the codec and builds the `ColumnRef` against the same `tableName`. Split those: codecs still resolve against the contract table, the `ColumnRef` points at the derived alias. The nested path does this by passing `innerAlias` to `buildIncludeAggregateExpr` (`query-plan-select.ts:1358`).

### 4. The byte-identity guard

A characterization test over a corpus of unpaginated aggregate chains (bare, `where`-only, `orderBy`-only, multi-selector, `count()`-only), snapshotting the compiled plan's AST. **It is generated and committed on pre-change code, in its own dispatch, before any of moves 1-3 land.** That ordering is the whole guard: a snapshot written after the change proves only self-consistency. Every later dispatch in this slice — and in slice 2 — must leave the snapshot file untouched; a diff in it is a halt condition, not something to update with `-u`.

**Contract impact:** none. **Adapter impact:** none — the wrap emits a derived table, `LIMIT`/`OFFSET`, and the existing portable `ROW_NUMBER` lowering. No adapter learns a new shape.

## Coherence rationale

One reviewer holds a single question in one sitting: *which rows does this chain describe, and how does the root aggregate consume that answer?* The extraction is a move-only diff, the signature change is mechanical, and the wrap is a few dozen lines that mirror a shape already living in the file they were lifted from. Splitting the extraction into its own PR would ship a module with one caller and no behaviour change — value that only materialises when the wrap lands.

## Scope

**In:** `src/query-plan-scope.ts` (new); `src/query-plan-select.ts` (extraction + re-import only); `src/query-plan-aggregate.ts` (`compileAggregate` signature + wrap); `src/collection.ts` (call site, TSDoc on `aggregate` / `take` / `skip` naming position semantics); `test/aggregate-pagination.test.ts` (rewritten against the derived-table shape, no `it.fails`); the new characterization snapshot test; integration tests asserting values on PGlite and SQLite for the root position.

**Added 2026-08-17, both operator-authorised after adversarial review of D3:**

- **The MTI variant join in `compileAggregate`.** Once the wrap emits `orderBy`, a variant-owned field resolves to a `ColumnRef` qualified against the variant table, which `compileSelect` joins in (`query-plan-select.ts:1500-1512`) and `compileAggregate` does not — so `.variant('Circle').orderBy(c => c.radius.desc()).take(10).aggregate(...)` emits a missing-FROM-entry error. `where()` over the same path is broken identically today. The operator chose to fix the join rather than document the hole, which closes both cases. STI is unaffected: those columns live on the base table.
- **The SQLite `OFFSET`-without-`LIMIT` renderer correction**, conditional on the integration dispatch confirming it. See the project spec's amended § Adapter impact.
- **A `distinctOn` capability gate in the ORM lane, type-level and runtime, at parity with sql-builder** (added 2026-08-18). `postgres.distinctOn` is an adapter-reported capability that the sql-builder lane enforces with both a `GatedMethod` type gate and a runtime `_gate` — proven on SQLite at `test/e2e/framework/test/sqlite/sql-builder.test.ts:345-352`. The ORM lane has never consulted it: `Collection.distinctOn`'s signature (`collection.ts:927-933`) reads field names and `hasOrderBy` but never `TContract['capabilities']`, so on SQLite the clause type-checks, records into state, survives plan-build, and is dropped by the renderer — a silently undeduped result. Pre-existing on `.all()`; this slice extends it to `.aggregate()`, and closes both.

  **This corrects the slice spec's own "Adapter impact: none" claim above.** That sentence's portability argument rests on the `ROW_NUMBER` lowering, which is true for `distinct` and false for `distinctOn` — `DISTINCT ON` is a Postgres-only, capability-gated feature. The claim was extended from one clause to the other without checking.

**Out:** everything grouped, including `compileGroupedAggregate`'s signature and `GroupedCollection` (slice 2). The nested scalar-refine path's emitted output — helpers move, output does not. `query-plan-mutations.ts`'s private remapper copy. Aggregate-alias ordering and `select()` in aggregate position (project non-goals). Root-level `count()` / `sum()` and friends need no equivalent fix: they throw outside include-refinement mode (`collection.ts:294`), so `.aggregate()` is the only root aggregate terminal.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| `where()` binds filters at authoring time (`collection.ts:369` → `normalizeWhereArg` → `bindWhereExpr`), so `buildStateWhere` re-binds an already-bound filter on this path | Expected no-op; the guard proves it | `bindComparable` returns an existing `ParamRef` unchanged (`where-binding.ts:131-137`), so re-binding should be idempotent. "Should" is why the characterization snapshot lands first — if it moves, halt and surface rather than accepting the new baseline. |
| One `ParamRef` instance reaching SQL twice desyncs `$N` / `?` binding | Keep filters in the inner select only; nothing re-emits them outside | `collectOrderedParamRefs` dedupes by identity while the SQLite renderer deliberately does not (`packages/2-sql/4-lanes/relational-core/src/ast/util.ts:13-32`). The per-target integration tests are what catch a regression here. |
| SQLite integration coverage has no emitted fixture for this model | Build the contract in-test | `test/integration/test/sql-orm-client/count-terminal-interleaving.test.ts` composes a SQLite runtime with `defineContract` from `@internal/sqlite/contract-builder` — a user-facing authoring surface, so `.agents/rules/no-contract-data-patching-in-tests.mdc` is satisfied. Don't emit a new fixture for this. |

## Slice-specific done conditions

- [ ] The characterization snapshot was generated on pre-change code and committed before any behaviour dispatch; its file is byte-unchanged at slice close.
- [ ] The two root-position tests in `test/aggregate-pagination.test.ts` no longer use `it.fails`, and their assertions target the derived table (`ast.limit` is `undefined`; the inner select carries the limit). The third test in that file is `groupBy().aggregate()` — it stays `it.fails` and is slice 2's to rewrite, which is why the project-DoD's "no `it.fails`" item closes there, not here.
- [ ] Integration tests assert **values**, not just SQL shape, on both PGlite and SQLite for the root position.
- [ ] `skip` without a paired `take` is exercised and emits `OFFSET` with no `LIMIT`.

## Open Questions

1. **Where does the behaviour-change note land?** There is no user-facing ORM chaining doc in `docs/` (`docs/reference/query-patterns.md` is the sql-builder DSL). Working position: TSDoc on the touched methods is the user-facing surface, and the PR description carries the behaviour-change flag that `draft-release-notes` reads at release-cut time. A standalone doc, if wanted, is a project close-out call.

## References

- Parent project: `projects/aggregate-pagination/spec.md`, `projects/aggregate-pagination/plan.md`
- Linear issue: none — this project runs tracker-free; the PR is the record
- Prior art: `packages/3-extensions/sql-orm-client/src/query-plan-select.ts:1237-1370` (the working wrap), `test/query-plan-select.test.ts:504` (pagination composes into the aggregate scope), `:545` (orderBy reapplied after the `ROW_NUMBER` dedup), `:486` (inert clauses dropped)
- ADR 201 — State-machine pattern for typed DSL builders
