# Brief: D5 R2 current-main reconciliation

## Task

Reconcile the completed slice with the latest `origin/main`, then clear reviewer findings F1 and F2: remove the transient project-name reference from production code, migrate any newly introduced live decimal fixtures from `@db.Numeric` to `Numeric(...)`, regenerate affected artifacts, and prove the full rebased branch remains green.

## Scope

**In:** Fetch/rebase onto current `origin/main`; conflict resolution that preserves settled slice-3 behavior; `packages/3-targets/3-targets/postgres/src/core/codecs.ts` comment cleanup; newly introduced current-main fixtures/artifacts containing live `@db.Numeric`; required regenerated outputs; focused tests and complete current-main validation; explicit-staging commits.

**Out:** Slice-4 implementation or diagnostics; ADR work; historical documentation rewrites; lowering coverage thresholds or adding waivers; GitHub replies; project/review artifact edits; unrelated mainline failures.

## Completed when

- [ ] F1 is resolved: no transient `remove-db-attributes` planning name remains in production code.
- [ ] F2 is resolved: the branch is rebased onto latest `origin/main`; all newly introduced live `@db.Numeric` fixtures use `Numeric(...)`, generated artifacts are current, and the live-usage grep contains only deliberate legacy-recognition coverage plus historical/planning material.
- [ ] Targeted contract-PSL coverage remains above existing thresholds, the waiver-aware coverage report has zero blocking failures, and all complete validation gates pass on the rebased tree.
- [ ] Changes are committed with explicit staging; do not push.

## Standing instruction

Stay focused on reviewer findings F1/F2 and current-main reconciliation. Preserve every existing user/orchestrator change. Halt rather than start slice 4 or fix unrelated mainline failures.

## Operational metadata

- **Model tier:** orchestrator — rebase/conflict resolution and cross-fixture validation require judgment.
- **Time-box:** 75 minutes.
- **Halt conditions:** Rebase requires discarding local commits; conflicts reveal a changed product decision; live `@db.*` usage requires deleting legacy support; validation fails only in unrelated current-main code after focused confirmation.

## Validation gates

- Targeted `contract-psl` coverage against its existing thresholds
- `pnpm coverage:report`
- `pnpm test:packages`
- `pnpm fixtures:check`
- `pnpm typecheck`
- `pnpm lint:deps`
- `pnpm test:integration`
- `pnpm test:e2e`
- Live-use `rg '@db\.' packages examples apps test` classification
