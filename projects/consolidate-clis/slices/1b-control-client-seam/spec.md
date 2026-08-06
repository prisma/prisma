# Slice spec — Prisma 8: route all migration/db commands through the control client

Linear: [TML-3173](https://linear.app/prisma-company/issue/TML-3173). Parent: [consolidate-clis plan](../../plan.md), Phase 1b slice 1. Repo: prisma/prisma.

## At a glance

14 command modules in `packages/1-framework/3-tooling/cli/src/commands/` import `@internal/migration-tools` directly (db-init, db-sign, db-update, migrate, migration-check, migration-graph, migration-list, migration-log, migration-new, migration-plan, migration-show, migration-status, migration-status-overlay, ref), bypassing the `ControlClient` seam in `src/control-api/`. After this slice, no command module imports `@internal/migration-tools`; every operation reaches it through the control-api surface. This is the precondition for moving the CLI implementation to the host repo with the control client staying here.

## Chosen design

- Extend `src/control-api/` to cover the operations commands currently reach directly. Two kinds:
  - **Connected operations** (need a database): already largely present on `ControlClient` (`migrate`, `dbInit`, `dbUpdate`, `sign`, `verify`); close any per-command gaps found during routing.
  - **On-disk operations** (migration interrogatives: plan resolution, graph/status/log/list/show reads, scaffolding, ref management): add as client-free standalone operations alongside the existing `executeContractEmit`/`executeDbInit` pattern in `src/control-api/operations/`. They take typed inputs and return structured result documents; no console, no `process.exit`, no `CliError`.
- Command modules keep argv parsing and rendering only. Logic currently in the 14 modules (and the `src/utils/` helpers they share: `plan-resolution.ts`, `ref-advancement.ts`, `migration-path-target.ts`, `contract-space-aggregate-loader.ts`, etc.) moves behind control-api exports where it is business logic, stays in utils where it is formatting.
- The public export surface stays `@internal/cli/control-api` → `@prisma/orm-toolchain/cli/control-api`; new operations ride the existing entrypoint.
- Non-goal here: removing `process.exit` from commands and the command→result→renderer reshape (slice 2); the test double (slice 3).

## Coherence rationale

One reviewer can hold this: it is a mechanical seam enforcement with a single invariant to check per file ("does this command module still import migration-tools?") plus the new operation signatures. The journey suites pin behavior; the diff is rollback-able as one unit.

## Scope

**In:** the 14 command modules; `src/control-api/operations/*` additions; `src/utils/*` helpers that carry business logic reachable only from those commands; a lint check (import-boundary rule or dependency-cruiser entry) making `@internal/migration-tools` unimportable from `src/commands/**`.

**Deliberately out:** command thinning/`process.exit` removal (slice 2); test double (slice 3); any change to `migration-cli.ts` (retires with the host port); config loader diagnostics (separate slice); renderer/output changes.

## Contract impact

None — tooling layer only; no `packages/0-shared/contract/**` or framework-core surface changes. Adapter impact: none.

## Pre-investigated edge cases

| Edge case | Disposition |
| --- | --- |
| `migration-status-overlay.ts` is a shared helper module, not a registered command; it still counts — it must route through control-api like the commands that use it | Route it; don't exempt it |
| Some utils (`cli-errors.ts`, `integrity-violation-to-check-failure.ts`) import migration-tools *types* only | Type-only imports of published types are acceptable; runtime imports are not — the lint rule distinguishes |
| `test/integration` journey suites import command factories via `@internal/cli/commands/*` and assert exact output | Behavior must be identical; snapshot churn is a red flag, not an acceptance |

## Slice-specific done conditions

- `grep -rl "@internal/migration-tools" packages/1-framework/3-tooling/cli/src/commands/` returns nothing (runtime imports), enforced by lint.
- New control-api operations are exported from `@internal/cli/control-api` and covered by at least the existing journey-suite paths.

## Open questions

None blocking; surface any operation whose extraction forces a control-api *interface* change (vs. addition) for discussion before implementing.

## References

- `packages/1-framework/3-tooling/cli/src/control-api/` (client.ts, types.ts, operations/)
- `.agents/rules/control-plane-descriptors.mdc`, ADR 151/204/207
- `docs/architecture docs/subsystems/11. CLI.md`
- [current-state.md § Seam quality](../../current-state.md)
