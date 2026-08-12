# Refactor `MigrationPlanner.plan()` API

## Summary

Collapse the redundant `fromHash` parameter into the existing `fromContract` parameter on `MigrationPlanner.plan(...)`. After the change, `fromContract: Contract | null` is the sole "from" identity input — required at every call site. Reconciliation commands (`db init`, `db update`) pass `null`; authoring commands (`migration plan`) pass the bookend they already have. Pure modeling fix: no observable behaviour change, no fixture regeneration.

**Spec:** `projects/refactor-plan-api/spec.md`
**Plan path:** `projects/refactor-plan-api/plans/plan.md` (orchestrator-expected location)

## Collaborators

| Role | Person/Team | Context |
| --- | --- | --- |
| Maker | William Madden | Drives execution |
| Reviewer | Terminal team (PR review) | Architectural review of planner-API surface |
| Collaborator | TML-2274 author | Sequencing — TML-2274 changes `migration.json` bookends; this project leaves them alone |

## Shipping Strategy

This is a single-PR internal API change. There is no consumer outside the monorepo, no on-disk artifact change, and no runtime behaviour change. Backward compatibility is therefore not a deployment concern — the change is atomic across the four call sites and three planner implementations.

The PR is shippable to `main` immediately after CI passes. The validation gate is the workspace test suite + typecheck: any consumer of `plan(...)` that still passes `fromHash` will fail typecheck, surfacing it before merge.

## Test Design

| AC | TC | Test Case | Type | Milestone | Expected Outcome |
| --- | --- | --- | --- | --- | --- |
| AC-1 | TC-1 | `MigrationPlanner.plan(...)` interface declares `fromContract: Contract | null` (required) and has no `fromHash` field | Type-level (TS compilation) | M1 | TS source typechecks; `fromHash` references on the interface produce errors |
| AC-2 | TC-2 | Workspace contains no `plan({... fromHash ...})` call sites in `packages/**/src/**` | Static (`grep`) | M1 | Zero matches |
| AC-3 | TC-3 | No production code in `packages/**/src/**` checks `fromHash === ''` or `fromHash === null` inside a `plan()` caller | Static (`grep`) | M1 | Zero matches |
| AC-4 | TC-4 | Postgres planner: `describe().from === fromContract.storage.storageHash` when `fromContract` provided, `null` otherwise | Unit | M1 | Both cases assert correctly |
| AC-4 | TC-5 | SQLite planner: same as TC-4 | Unit | M1 | Both cases assert correctly |
| AC-4 | TC-6 | Mongo planner: same as TC-4 | Unit | M1 | Both cases assert correctly |
| AC-5 | TC-7 | `db-init` invokes `plan()` with `fromContract: null`; resulting `MigrationPlan.origin === null` | Unit (existing test updated, or new) | M1 | Origin is null |
| AC-5 | TC-8 | `db-update` invokes `plan()` with `fromContract: null`; resulting `MigrationPlan.origin === null` | Unit (existing test updated, or new) | M1 | Origin is null |
| AC-6 | TC-9 | `migration plan` against a fresh workspace (no prior bundle) writes `migration.json` with `from === null` | Integration / E2E | M1 | `from` field is `null` |
| AC-6 | TC-10 | `migration plan` against a workspace with one prior bundle writes `migration.json` with `from === bundle.metadata.to` | Integration / E2E | M1 | `from` matches prior bundle's `to` |
| AC-7 | TC-11 | Workspace test suite passes without fixture regeneration | Harness (`pnpm test:packages`) | M1 | All tests green |
| AC-8 | TC-12 | `MigrationScaffoldContext.fromHash` interface unchanged | Type-level (TS compilation, code review) | M1 | Field still present and typed `string \| null` |
| AC-9 | TC-13 | `Migration.origin` getter unchanged | Static (code review) | M1 | Source identical to pre-change |

## Milestones

### Milestone 1: Collapse `fromHash` into `fromContract` on `MigrationPlanner.plan()`

The entire spec ships in one milestone — there is no natural intermediate "demo-able" state, and splitting the work would leave the planner interface in a half-migrated condition. Single PR.

**Tasks:**

- [ ] Update `MigrationPlanner.plan(...)` interface in `packages/1-framework/1-core/framework-components/src/control/control-migration-types.ts`: remove `fromHash`, change `fromContract?: unknown` to `fromContract: Contract | null` (required, typed). (satisfies: TC-1)
- [ ] Update postgres planner (`packages/3-targets/3-targets/postgres/src/core/migrations/planner.ts`): remove `fromHash` from `plan()` and internal helpers (e.g. `planSql`); derive `from` for `describe()` stamping as `options.fromContract?.storage.storageHash ?? null`. (satisfies: TC-4)
- [ ] Update sqlite planner (`packages/3-targets/3-targets/sqlite/src/core/migrations/planner.ts`): same change as postgres. (satisfies: TC-5)
- [ ] Update mongo planner (`packages/3-mongo-target/1-mongo-target/src/core/mongo-planner.ts`): same change as postgres. (satisfies: TC-6)
- [ ] Update `db-init` (`packages/1-framework/3-tooling/cli/src/control-api/operations/db-init.ts`): replace `fromHash: null` with `fromContract: null` in the `plan()` call. Drop the now-stale comment about `fromHash` baseline encoding. (satisfies: TC-7, TC-2)
- [ ] Update `db-update` (`packages/1-framework/3-tooling/cli/src/control-api/operations/db-update.ts`): same change as `db-init`. (satisfies: TC-8, TC-2)
- [ ] Update `migration plan` (`packages/1-framework/3-tooling/cli/src/commands/migration-plan.ts`): remove `fromHash` from the `plan()` call (keep `fromContract`). (satisfies: TC-2, TC-9, TC-10)
- [ ] Update `migration new` (`packages/1-framework/3-tooling/cli/src/commands/migration-new.ts`): if its `plan()` invocation passes `fromHash`, remove it; do **not** touch the `emptyMigration({ fromHash, toHash })` call. (satisfies: TC-2, TC-12)
- [ ] Update direct planner unit tests in postgres, sqlite, mongo — replace synthetic `fromHash` fixtures with `fromContract` fixtures (or `null`). Keep test coverage of the "no prior contract" and "with prior contract" branches. (satisfies: TC-4, TC-5, TC-6)
- [ ] Update or add unit tests for `db-init` and `db-update` asserting `MigrationPlan.origin === null` after the change. (satisfies: TC-7, TC-8)
- [ ] Verify (existing) integration / E2E tests for `migration plan` cover both the first-migration (no `fromContract`) and subsequent-migration cases. Add coverage if missing. (satisfies: TC-9, TC-10)
- [ ] Run grep over `packages/**/src/**` for `fromHash` to confirm only the surviving sites are: `MigrationScaffoldContext.fromHash`, `MigrationMeta.from` / `MigrationMetadata.from`, and migration-graph internals. No remaining `plan(...)` callers. (satisfies: TC-2, TC-3)
- [ ] Run validation gate (typecheck + workspace tests). (satisfies: TC-11)

**Validation gate:**

- `pnpm typecheck`
- `pnpm test:packages`
- `pnpm lint:deps`

### Close-out (required)

- [ ] Verify all acceptance criteria in `projects/refactor-plan-api/spec.md` are met (link to tests / PR diff).
- [ ] Decide whether the modeling rationale ("orphan-hash anti-pattern; reconciliation commands have no origin contract") warrants an ADR. **Default assumption: no** — this is a localised API tightening, not a system-architecture decision. Confirm with reviewer at PR time; if ADR is wanted, draft under `docs/architecture docs/adrs/` and link from the planner interface.
- [ ] Strip references to `projects/refactor-plan-api/**` from `docs/`, READMEs, and other durable artifacts (likely none — the project is internal-API-only).
- [ ] Delete `projects/refactor-plan-api/`.
- [ ] Do **not** manually transition TML-2275; the linked PR's merge will auto-complete it via GitHub integration (branch name carries the identifier).

## Open Items

- **ADR or no ADR.** Default: no. The change is API-surface hygiene, not a load-bearing architectural decision. Re-evaluate at PR time.
- **Coordinate with TML-2274.** TML-2274 plans to remove `fromContract` / `toContract` bookends from `migration.json` entirely. If TML-2274 lands first, this project's "stamp `from` from `fromContract.storage.storageHash`" mechanism is unaffected (it operates on the plan-time `fromContract` argument, not the bookend in `migration.json`). If TML-2274 lands after, no rework needed. No hard sequencing requirement either way.
