# Slice 2: filter EXISTS through the junction — Dispatch plan

**Spec:** `projects/sql-orm-many-to-many/slices/02-filter-exists-through-junction/spec.md`
**Linear:** [TML-2786](https://linear.app/prisma-company/issue/TML-2786)

Two dispatches: filter code (judgment) then integration tests (verification). No fixture dispatch — slice 1's `User ↔ Tag` is reused.

### Dispatch 1: filter EXISTS walks the junction

- **Outcome:** `some`/`every`/`none` on an M:N relation compile to a correctly-shaped EXISTS / NOT EXISTS that walks the junction (target JOIN junction correlated to parent on the junction side; composite-key AND-ed); FK filters unchanged. Unit-tested at the AST level.
- **Builds on:** slice 0's `ResolvedRelation.through` (carried by `resolveModelRelations`).
- **Hands to:** correctly-shaped M:N relation filters — the behaviour D2 verifies on the DB.
- **Focus:** the M:N branch in `buildExistsExpr`/`buildJoinWhere` (`model-accessor.ts`); surface `through` onto the filter relation if it's dropped; unit tests for the EXISTS AST (some/every/none through junction). No integration tests here.

### Dispatch 2: filter integration tests (operator standard)

- **Outcome:** integration tests prove `.filter(u => u.tags.some/every/none(...))` returns the right users on PGlite, following the standard — whole-row `toEqual` on the filtered set, explicit `.select` in most, **≥1** implicit/default-selection case; `some`, `every`, `none`, and an empty-match edge covered.
- **Builds on:** D1's filter code + slice 1's fixture/seed helpers (`seedUserTags`).
- **Hands to:** the slice-DoD-satisfying M:N filter coverage.
- **Focus:** new integration test file under `test/integration/test/sql-orm-client/`, PGlite via `withCollectionRuntime`; reuse the `seedTags`/`seedUserTags` helpers slice 1 added. Run via `cd test/integration && pnpm test test/sql-orm-client/<file>`.

## Handoff completeness

Slice-DoD reachable: correctly-shaped junction EXISTS (D1 unit) + filter behaviour on DB per standard (D2 integration) + FK filters unchanged (D1).
