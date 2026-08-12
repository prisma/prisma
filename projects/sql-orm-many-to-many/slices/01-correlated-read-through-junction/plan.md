# Slice 1: correlated read through the junction — Dispatch plan

**Spec:** `projects/sql-orm-many-to-many/slices/01-correlated-read-through-junction/spec.md`
**Linear:** [TML-2785](https://linear.app/prisma-company/issue/TML-2785)

Three dispatches. Fixture (data) and read-code (logic) are split from the integration tests (verification) so the projection-builder judgment isn't buried in the goldens fan-out (per `sizing.md`). Test-first throughout.

### Dispatch 1: integration fixture gains an M:N relation

- **Outcome:** the sql-orm-client integration fixture defines a **User ↔ Tag** M:N relation via a `UserTag` junction (`userId`, `tagId`, composite PK, no payload columns); `contract.json` + `contract.d.ts` are re-emitted and committed; the M:N relation round-trips `validateContract` (slice 0 made that possible).
- **Builds on:** slice 0's validatable M:N contract shape.
- **Hands to:** a committed integration fixture carrying a pure-junction M:N relation — the data foundation D3's integration tests and D2's reasoning use.
- **Focus:** add the relation + junction model to the fixture **source** schema; re-emit the generated `contract.json`/`contract.d.ts`. Additive to the fixture (existing models unchanged). Note the pre-existing `fixtures:emit` CLI-on-PATH env limitation — verify the re-emitted contract by inspecting its diff; CI runs the real gate.

### Dispatch 2: read path correlates through the junction

- **Outcome:** `buildCorrelatedIncludeProjection` (`query-plan-select.ts`) emits a **single correlated subquery** walking parent → junction → target when the resolved include relation carries `through` (`target JOIN junction ON junction.childColumns = target.targetColumns WHERE junction.parentColumns = parent`); `IncludeExpr` carries `through` (surfaced by `resolveIncludeRelation`); the include-child decode/graft assembles `tags: Tag[]`. Unit tests assert the correlated junction AST (composite-key AND-ed; **no `LATERAL`**).
- **Builds on:** slice 0's `ResolvedRelation.through` (not D1 — unit-tested against hand-built contracts).
- **Hands to:** an M:N include that resolves to `tags: Tag[]` in one execution, unit-proven at the AST level.
- **Focus:** `resolveIncludeRelation` + `IncludeExpr.through` (`collection-contract.ts`, `types.ts`); the M:N branch in `buildCorrelatedIncludeProjection` + child decode; `query-plan-select` unit tests. No integration tests here (D3). No filter/write surfaces.

### Dispatch 3: M:N include integration tests (operator standard)

- **Outcome:** integration tests prove `db.orm.User.include('tags')` returns `{ …user, tags: Tag[] }` on PGlite, following the standard — whole-row `toEqual`, explicit `.select(...)` in most cases, **≥1 implicit/default-selection** case for the nested M:N read, a **single-execution / no-`LATERAL`** assertion, and depth-2 nesting through the junction.
- **Builds on:** D1's fixture **and** D2's read path (non-linear — needs both hand-offs).
- **Hands to:** the slice-DoD-satisfying M:N read coverage; the fixture + patterns the filter/write slices reuse.
- **Focus:** new integration test file(s) alongside `include.test.ts` / `nested-includes.test.ts`, PGlite via `withCollectionRuntime` (SQLite too only if the harness already supports it). Match the existing whole-row assertion corpus; add the explicit-select-dominant + implicit-select cases the standard requires.

## Handoff completeness

Slice-DoD reachable: single-execution M:N include (D2 unit + D3 integration) · whole-row/explicit-select/implicit-select standard (D3) · fixture M:N committed (D1). D3's hand-off (working M:N read + fixture) is what slices 2/3 build on.
