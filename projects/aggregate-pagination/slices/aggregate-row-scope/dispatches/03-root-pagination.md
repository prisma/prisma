# Brief: D3 — root `.aggregate()` honours `take` / `skip` / `cursor`

## Task

Make `compileAggregate` reduce over the rows the chain describes instead of every matching row. Two changes, one outcome:

1. **Signature.** `compileAggregate` takes the collection's `CollectionState` in place of `filters: readonly AnyExpression[]`. Call sites: `src/collection.ts:1139` (pass `this.state`), `test/query-plan-aggregate.test.ts`, and any aggregate case in `test/rich-query-plans.test.ts`. **`compileGroupedAggregate` keeps its `filters` parameter** — that is an operator decision, not an oversight; a compile function that receives a scope it ignores is the exact shape this project exists to remove, and the grouped path gains its state in the next slice alongside the behaviour that consumes it.

2. **Conditional wrap.** When the chain carries a limit or an offset, wrap the source in a derived table aliased `${tableName}__scoped`: the inner select carries the WHERE (filters plus the cursor boundary), the ORDER BY, and the LIMIT / OFFSET; the outer select carries the aggregate projection, reading its columns off the derived alias. When the chain carries neither, the emitted plan must be what it is today — produced by the same code path, not re-derived to match.

`cursor` is deliberately **not** part of the wrap condition. It lowers to a WHERE boundary that `buildStateWhere` folds in either way — exactly what the nested path does at `src/query-plan-select.ts:1237-1241`. A cursor on an otherwise-unpaginated aggregate therefore changes today's output (correctly: today the cursor is silently dropped) without introducing a derived table.

`orderBy` alone stays inert and dropped, which is both today's behaviour and the house style for clauses that cannot change the answer.

`distinct` / `distinctOn` are **not** in this dispatch. They widen the same condition and add one branch inside the inner-select builder; that is the next dispatch.

## The shape

```sql
-- .orderBy(views desc).skip(5).take(10).aggregate(agg => ({ totalViews: agg.sum('views') }))
SELECT sum(posts__scoped.views) AS totalViews
FROM (
  SELECT posts.views AS views
  FROM posts
  WHERE …
  ORDER BY posts.views DESC
  LIMIT 10 OFFSET 5
) posts__scoped
```

Details the nested prior art already settles — read it rather than re-deriving:

- **Inner projection** — one item per distinct `selector.column` across the aggregate spec, plus a `ProjectionItem.of('__row', LiteralExpr.of(1))` when any selector has no column (a bare `count()`). See `query-plan-select.ts:1294-1299`.
- **Outer aggregates read the alias.** `toAggregateProjection` currently resolves the result codec and builds the `ColumnRef` against the same `tableName`. Those two uses have to come apart: codecs still resolve against the contract's table, the `ColumnRef` points at the derived alias. The nested path does this by passing `innerAlias` to `buildIncludeAggregateExpr` (`query-plan-select.ts:1358`).
- **Parameters.** Filters belong to the inner select only. Nothing may re-emit them in the outer select: `collectOrderedParamRefs` dedupes by `ParamRef` identity while the SQLite renderer deliberately does not, so one `ParamRef` instance reaching SQL twice desyncs `$N` / `?` binding.

## Tests first

This repo's rule is tests before implementation, and here it is also the cheapest way to discover you have the shape wrong.

Rewrite the **two root-position cases** in `test/aggregate-pagination.test.ts` against the real compiled shape, watch them fail, then implement. Their current assertions (`ast.limit === 10`) describe an outcome nobody wants — under a correct implementation the top-level `limit` is `undefined` and the derived table carries it. Do not flip them from `it.fails` to `it` as-is.

The **third case in that file is `groupBy().aggregate()`** — leave it exactly as it is, still `it.fails`. It belongs to the next slice, and the project-DoD item about removing `it.fails` closes there.

Add whatever unit coverage the new shape needs beyond those two — `skip` without a paired `take` (`OFFSET` with no `LIMIT`, which is well-defined under row-scoping), and a cursor case that proves the boundary reaches the WHERE without introducing a derived table.

## Scope

**In:** `src/query-plan-aggregate.ts`, `src/collection.ts` (the one call site), `test/aggregate-pagination.test.ts`, `test/query-plan-aggregate.test.ts`, `test/rich-query-plans.test.ts` (call-site migration only).

**Out:** `src/grouped-collection.ts` and everything grouped. `src/query-plan-select.ts` — the nested path's emitted output must not move. `distinct` / `distinctOn`. TSDoc (its own dispatch). The baseline snapshot file.

## Completed when

- [ ] An aggregate chain carrying `take` and/or `skip` compiles to a `${tableName}__scoped` derived table whose inner select holds the limit/offset, with the outer select's `limit` / `offset` undefined.
- [ ] `skip` without `take` emits `OFFSET` with no `LIMIT`.
- [ ] A `cursor` on an unpaginated aggregate reaches the WHERE and introduces **no** derived table.
- [ ] The two root-position tests in `test/aggregate-pagination.test.ts` no longer use `it.fails`; the grouped one still does.
- [ ] **The baseline snapshot is byte-unchanged.** Verify with `git status` / `git diff` on that file and say so explicitly in your report.
- [ ] A unit test proves no `ParamRef` **instance** crosses the inner/outer boundary twice — e.g. for a filtered, paginated aggregate, walk the compiled AST's param refs and assert each object appears exactly once, and that `plan.params` length matches. Object identity, not value equality: two distinct `ParamRef`s carrying the same value are exactly the bug, and they are indistinguishable by value. The baseline snapshot structurally cannot catch this (pretty-format serializes both identically), and D5's per-target integration tests are two dispatches away — this assertion closes the gap in between.
- [ ] Validation gates below all pass.

## Validation gates

- `cd packages/3-extensions/sql-orm-client && pnpm typecheck`
- `pnpm --filter @internal/sql-orm-client test`
- `pnpm --filter @internal/sql-orm-client lint`
- `pnpm fixtures:check`

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note. Anything that pulls you off the goal halts and surfaces.

## Halt conditions

- **The baseline snapshot changes.** This is the slice's hardest constraint failing. Halt, report the exact diff, and do not regenerate it. In particular, if re-binding an already-bound filter through `buildStateWhere` turns out *not* to be idempotent, the snapshot is how you will find out — that is a finding for the orchestrator, not something to work around.
- Completing the task requires touching the grouped path or changing what `query-plan-select.ts` emits.
- The wrap cannot be built without duplicating a `ParamRef` across the inner/outer boundary.
- 90 minutes wall-clock.

## House rules that apply

- Never `any`; no bare `as` in production code — use `blindCast<T, "Reason">` / `castAs<T>` from `@internal/utils/casts` (see the `no-bare-casts` skill for the decision tree). Test files are exempt.
- `.agents/rules/no-target-branches.mdc` — no branching on target; this emits plain relational AST.
- `.agents/rules/omit-should-in-tests.mdc`, `.agents/rules/sql-orm-client-whole-shape-assertions.mdc`, `.agents/rules/no-transient-project-ids-in-code.mdc`.
- Don't add comments if avoidable; prefer code that expresses its intent.

## References

- Slice spec § Chosen design steps 2-3 — the decided shape, aliases, and the projection rule.
- Slice spec § Pre-investigated edge cases — the binding trap and the `ParamRef` trap, both with citations.
- Slice plan § Dispatch 3.
- Prior art to mirror: `src/query-plan-select.ts:1237-1370`; its tests at `test/query-plan-select.test.ts:504` and `:486`.

## Operational metadata

- **Model tier:** orchestrator — this dispatch carries the slice's design judgment.
- **Time-box:** 90 minutes wall-clock. Overrun → halt and surface.
