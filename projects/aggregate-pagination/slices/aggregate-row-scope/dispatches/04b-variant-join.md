# Brief: D4b — the MTI variant join in `compileAggregate`

_Inserted by operator decision on 2026-08-17, after adversarial review of D3 surfaced the hole. See the slice spec § Scope and the slice plan § Dispatch 4b._

## Task

`compileAggregate` builds its FROM from `tableSourceForContract(contract, namespaceId, tableName)` alone. For a model narrowed with `.variant(...)` under multi-table inheritance, variant-owned fields resolve to a `ColumnRef` qualified against the **variant** table — which `compileSelect` joins in (`query-plan-select.ts:1500-1512`) and `compileAggregate` does not. So

```typescript
db.orm.Shape.variant('Circle').orderBy((c) => c.radius.desc()).take(10)
  .aggregate((a) => ({ n: a.count() }));
```

emits an inner select ordering by `circles.radius` while its FROM names only `shapes` — a missing-FROM-entry error at the driver.

Teach `compileAggregate` the same join. Mirror `compileSelect`'s strategy; do not derive a second one.

**The pre-existing `where()` case is in scope.** A variant-owned column in a `where()` predicate is broken on this path today, before and independently of this slice — it is the same missing join. Fixing `orderBy` and leaving `where()` would be arbitrary, and the operator chose the fix over documenting the hole precisely to close both.

**STI needs nothing.** Single-table-inheritance variants keep their columns on the base table, so no join is involved. Confirm that rather than assuming it, and say so in your report.

## Where the join must go — settled in advance, do not rediscover

Add the join to `inner` **before** the distinct branch (i.e. before the `distinctOn` / `distinct` / plain-`orderBy` three-way split in `compileAggregate`). `withProjection` preserves joins through `toOptions()` (`relational-core/src/ast/types.ts:1644-1646`), so `wrapWithRowNumberDedup` carries the join into the **ranked subquery** — which is exactly where it is needed, because both the `PARTITION BY` list and the hidden-order expressions reference the variant table inside `base`.

If instead the join is applied to the already-wrapped `inner` (after the branch), it lands on the **outer** dedup select, where the variant-qualified column in the window spec and the hidden-order projection is out of scope — invalid SQL, in the branch least likely to be covered by a test.

One consequence worth knowing: under `distinct` + `orderBy`, the reapplied ordering reads `${tableName}__scoped_distinct.${tableName}__order_${index}` and never re-references the variant table. So all three branches need the join in exactly one place.

This came from an adversarial review of the dispatch before yours; it is settled, not a hint.

## `orderBy` is the only axis you need to prove — settled, do not re-derive

Once the join lands, `orderBy` is the **only** way a variant-qualified `ColumnRef` can reach the root inner select. The other two candidates are closed by construction:

- `distinct` / `distinctOn` — `mapFieldsToColumns(contract, namespaceId, this.modelName, fields)`, parameter typed `keyof DefaultModelRow<TContract, ModelName>`. Base model only (`collection.ts:894-946`).
- the aggregate selector's column — `createAggregateBuilder(contract, aggregates, namespaceId, this.modelName)` builds from the **base** model's `fieldToColumn` and takes no `variantName` (`aggregate-builder.ts:18-34`, called at `collection.ts:1112-1117`).

So the test surface is one axis, not three. Cover `orderBy` (wrapped and unwrapped) and `where()`; do not spend effort constructing variant-qualified `distinct` or selector cases — they are unreachable.

A self-referencing MTI hierarchy (a variant table whose FK points back at the base) changes nothing: `buildMtiJoins` joins each variant table once, and an FK back to the base is just a column. Root has one level.

## Scope

**In:** `src/query-plan-aggregate.ts` (`compileAggregate` only), plus tests covering a variant-owned column in `orderBy` and in `where()`, wrapped and unwrapped.

**Out:** `compileGroupedAggregate` — the grouped path takes its filters from `baseFilters` and is slice 2's to fix; if the same hole exists there, report it rather than fixing it. `compileSelect` — it already works; read it, don't change it. Everything `distinct`-related, now settled.

## Completed when

- [ ] A variant-owned column referenced by `orderBy` on a root aggregate compiles to a plan whose FROM joins the variant table, for both the wrapped and unwrapped paths.
- [ ] The same holds for a variant-owned column in `where()`.
- [ ] A test covers each, and each **would fail without the join** — say which assertion discriminates, as you did for the reapplication test in D4.
- [ ] STI variants are confirmed unaffected, with a test or an explicit statement of why one is unnecessary.
- [ ] **The baseline snapshot is byte-unchanged.** No corpus chain uses `variant()`, so a move here means the join leaked into the non-variant path.
- [ ] Validation gates pass.

## Validation gates

- `cd packages/3-extensions/sql-orm-client && pnpm typecheck`
- `pnpm --filter @internal/sql-orm-client test`
- `pnpm --filter @internal/sql-orm-client lint`
- `pnpm fixtures:check`

## Standing instruction

Stay focused on the goal; control scope. Anything that pulls you off the goal halts and surfaces.

## Halt conditions

- **The join cannot be added without restructuring how `compileAggregate` builds its FROM in the non-variant case.** The non-variant path must keep emitting exactly what it emits today — the baseline snapshot is the check, and a restructure that moves it is a design problem, not something to work around.
- The variant join interacts badly with the `distinct` dedup wrap — e.g. the join has to sit inside the dedup's inner select and the existing helper cannot express it. Halt and surface; do not adapt `wrapWithRowNumberDedup`.
- The polymorphism fixtures do not cover MTI in a shape this can be tested against. Report what exists rather than authoring a new fixture.
- 90 minutes wall-clock.

## House rules that apply

- No `any`; no bare `as` in production code. Test files exempt.
- `.agents/rules/omit-should-in-tests.mdc`, `.agents/rules/sql-orm-client-whole-shape-assertions.mdc`, `.agents/rules/no-transient-project-ids-in-code.mdc` — no `D4b` or project-slug strings in test names or comments.
- Heartbeat on the ~5-minute cadence during long gates, per your own note after D4.

## References

- `src/query-plan-select.ts:1500-1512` — the join strategy to mirror.
- `src/model-accessor.ts:222-229` — documents how a variant-owned field gets qualified against the variant table.
- Existing polymorphism coverage: `test/polymorphism.test-d.ts`, `test/variant-include.query-plan-nested.test.ts`, and the `fixtures/polymorphism/` contract.
- Slice spec § Scope (amended 2026-08-17) for why this is in the slice at all.

## Operational metadata

- **Model tier:** mid, on the persistent implementer.
- **Time-box:** 90 minutes wall-clock.
