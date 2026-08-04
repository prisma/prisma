# Brief: D6 — the ORM aggregate cut

## Task

Make every ORM aggregate path resolve, project, type, and decode through the descriptor system, as one coherent flip. Planning: `toAggregateProjection` (`packages/3-extensions/sql-orm-client/src/query-plan-aggregate.ts`) resolves count/sum/avg output codecs from the `QueryLaneContext` aggregate registry instead of stamping `undefined` (min/max keep their column codec where the registry says `self`); both its call sites (`compileAggregate`, `compileGroupedAggregate`) carry the resolved codec into `ProjectionItem`. Include reducers (`buildIncludeChildScalarSelect` / `buildIncludeAggregateExpr`, `query-plan-select.ts`) stamp the resolved codec so `jsonEntryProjection` codec-projects aggregate JSON entries — the `native` whitelist in `test/json-projection-emission.test.ts` disappears and the test states the strengthened invariant (AC-1). Decoding: the `Number()`-coercion shims — `normalizeAggregateResult` (`collection-aggregate-result.ts`) and `coerceAggregateValue` (`grouped-collection.ts`) — are deleted, decoding flows through the generic codec path (`packages/2-sql/5-runtime/src/codecs/decoding.ts`); include extraction (`collection-dispatch.ts` `parsed['value']`) decodes through the resolved codec's `decodeJson`, and `emptyScalarResult`'s count empty-set value becomes `0n`. Types: ORM aggregate availability and result surfaces (`AggregateSelector` and friends in `src/types.ts`) resolve from the emitted `aggregateTypes` with the same exact-over-trait-over-any precedence — `count()` types `bigint` and the runtime returns it. Every moved expectation is classified mechanical-form-change vs corrected-defect (the slice-4 D2 discipline), across: sql-orm-client unit suites (`collection-aggregate-result.test.ts` is renegotiated or deleted — it pins the coercion being removed; `grouped-collection.test.ts`; `aggregate-builder.test.ts`; `orm.types.test-d.ts`), `test/integration/test/sql-orm-client/aggregate.test.ts`, and the ports suites (`legacy-aggregations`, `methods-count`, `issues-20261-group-by-shortcut`, `issues-11974`) — updated in place to the breaking baseline, no compat shims.

## Scope

**In:** the surfaces above; new/renegotiated tests for empty-set aggregates (top-level `{ count: 0n, total: null, avg: null }`; include count over empty set `0n`), decimal-string sums/averages on PostgreSQL, `real` averages on SQLite, and a beyond-2^53 count or sum through `.include()` proving the lossless claim end-to-end.

**Out:** the sql-builder lane (D7 — `CountField`, `runtime/functions.ts`, `group-by.test.ts` are NOT yours even though adjacent and tempting); emitter changes (D5, done); `having` semantics; Mongo; docs/upgrade instructions (D8).

## Completed when

- [ ] AC-1: the whitelist in `json-projection-emission.test.ts` is gone; every aggregate JSON entry carries its resolved output codec; the test states the strengthened invariant.
- [ ] `grep -rn "normalizeAggregateResult\|coerceAggregateValue" packages/` returns nothing, and no `Number(` bridge reappears in the aggregate decode path (F1-class relocation check).
- [ ] A live-database test reads an aggregate value past 2^53 through the ORM (top-level AND include) losslessly on PostgreSQL; SQLite `count` past 2^53 likewise.
- [ ] Every moved expectation in the report is classified; validation gates green.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note. Anything that pulls you off the goal — even if it looks useful — halts and surfaces.

## References

- Slice spec § ORM planning and decoding, § Pre-investigated edge cases (driver wire shapes: node-postgres/PGlite return int8 as text top-level, better-sqlite3/node:sqlite return number-or-bigint — decode wire values through `codec.decode`, JSON values through `codec.decodeJson`; the `decoding.ts` split already distinguishes the channels).
- D2/D3/D4 hand-offs: the registry on `QueryLaneContext`; both targets' matrices (PostgreSQL `avg` → numeric decimal string; SQLite `avg` → real number — the targets diverge, resolve per descriptor).
- D5's hand-off: the emitted `aggregateTypes` shape and its type-level precedence proof.
- Rules: `sql-orm-client-whole-shape-assertions` (assert whole result shapes with explicit select), `prefer-object-matcher`, `use-timeouts-helper-in-tests`.

## Operational metadata

- **Model tier:** `orchestrator` — the cut spans planning, types, and decode with per-target divergence; L-sized judgment.
- **Time-box:** 3 hours wall-clock. Overrun → halt and surface.
- **Halt conditions:** the emitted `aggregateTypes` shape cannot express something the type-level resolver needs (falsifies D5 — surface, do not patch around); any ports-suite expectation whose move cannot be classified as mechanical-form-change or corrected-defect; any need to touch sql-builder or emitter surfaces; the include decode path needing codec-ID knowledge anywhere generic.

## Validation gates

```bash
pnpm build
pnpm typecheck
pnpm lint:deps
pnpm lint --filter <touched>
pnpm test --filter @internal/sql-orm-client --filter <other touched> --filter @internal/integration-tests
pnpm fixtures:check
```

Foreground only; long output saved once under `wip/`; environment-blocked classification per the D1 precedent (the integration suite is on the deferred-gate list — a green run here would clear part of that condition; note it either way); the `check:upgrade-coverage` red is D8's.
