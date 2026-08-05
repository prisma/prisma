# Brief: D7 — the sql-builder lane cut

## Task

Make the sql-builder lane's aggregate functions resolve through the aggregate registry, retiring the last hardcoded codec ID outside the targets. Today `CountField` hardcodes `codecId: 'pg/int8@1'` in a target-agnostic lane (`packages/2-sql/4-lanes/sql-builder/src/expression.ts:122`) and the runtime repeats it (`src/runtime/functions.ts:168-173`); `numericAgg` (`functions.ts:128-136`) propagates the INPUT codec through `sum`/`avg`, which the probed matrices show is wrong under widening (`sum(int4)` → int8; `avg(int4)` → numeric on PostgreSQL, real on SQLite). Both resolve through the registry on the lane's `ExecutionContext` (`aggregateDescriptors`, D2's exposure); aggregate expressions populate the `codec` slot on `ScopeField` that `ProjectionItem.of(alias, expr.buildAst(), field.codec)` reads (`runtime/builder-base.ts:322, 336`), so aggregate results decode through the generic path with no lane-local coercion. `count(x)` resolves through the input-agnostic rung — the case that motivated the fourth kind. `CountField`'s static `bigint` typing stays (both targets' count codecs agree on the application type); type-level `sum`/`avg` result types move onto the emitted `aggregateTypes` if the lane's type machinery consumes contract type maps, or stay as-is with a report note if the lane's static typing is out of the emitted map's reach — investigate and record, do not force it. The roadmap witness flips: `test/integration/test/sql-builder/group-by.test.ts:18` asserts `2n`, not `'2'` (AC-2).

## Scope

**In:** the sql-builder lane's aggregate functions and their typing (`expression.ts`, `runtime/functions.ts`, any `builder-base.ts` touch the codec slot needs); the lane's unit tests and the sql-builder integration suites' moved expectations, classified; the grep gate.

**Out:** the ORM (D6 — runs independently of this dispatch); emitter and matrices (done); `having`; Mongo; docs (D8).

## Completed when

- [ ] `grep -rn "pg/int8@1" packages/ --include="*.ts"` hits nothing outside `packages/3-targets` and regenerated `contract.d.ts` fixtures.
- [ ] `test/integration/test/sql-builder/group-by.test.ts` asserts `2n` and passes against a live database.
- [ ] `count(x)` (with an input) resolves and decodes — a test exercises it through the lane end-to-end.
- [ ] Validation gates green.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note. Anything that pulls you off the goal halts and surfaces.

## References

- Slice spec § sql-builder lane; the amended § Aggregate descriptors (input-agnostic kind).
- D2's hand-off (registry on `ExecutionContext`), D3/D4 matrices (the widening rows), D5's emitted map (if the lane's typing can consume it).
- The known trap: `descriptorsFromCodecs` drops traits; declare descriptors directly in tests.

## Operational metadata

- **Model tier:** `orchestrator` — the typing-vs-runtime seam in the lane needs judgment; the rest is a narrow cut.
- **Time-box:** 2 hours wall-clock. Overrun → halt and surface.
- **Halt conditions:** the lane cannot reach the registry without a layering violation; the static typing cannot express the per-target divergence and forcing it would lie (surface the shape instead); any ORM surface needed.

## Validation gates

```bash
pnpm build
pnpm typecheck
pnpm lint:deps
pnpm lint --filter <touched>
pnpm test --filter <touched> --filter @internal/integration-tests
pnpm fixtures:check
```

Foreground only; long output saved once under `wip/`; environment-blocked classification per the D1 precedent; the `check:upgrade-coverage` red is D8's.
