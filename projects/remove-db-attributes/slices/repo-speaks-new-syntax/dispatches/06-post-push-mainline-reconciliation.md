# Brief: D6 post-push mainline reconciliation

## Task

Fetch and rebase PR #1036 onto the newest `origin/main` after GitHub reported `mergeStateStatus: DIRTY`; resolve conflicts in favor of settled slice-3 intent, migrate any newly inherited live old-syntax fixtures, regenerate affected artifacts, and validate the conflict-free head.

## Scope

**In:** Latest-main rebase; conflict resolution; newly inherited live `@db.*` fixture migrations required by slice 3; generated artifacts; targeted conflict-area validation followed by the complete slice gate; focused signed commits; no push by the implementer.

**Out:** Slice-4 implementation, migration diagnostics, ADRs, GitHub replies, historical prose rewrites, unrelated mainline fixes, project/review artifact edits.

## Completed when

- [ ] Branch is based on the latest fetched `origin/main`, Git reports no unresolved conflicts, and no local commit is discarded.
- [ ] Any newly inherited live old-syntax fixture is migrated consistently and regenerated; live-use classification remains within the slice-3 boundary.
- [ ] Full validation gates pass on the newly rebased tree and tracked state is clean.
- [ ] Any conflict-resolution changes are committed with explicit staging; do not push.

## Standing instruction

Resolve only the newest-main conflict and its direct validation fallout. Preserve settled code and project artifacts. Halt if the conflict reveals a changed product decision or requires slice-4 work.

## Operational metadata

- **Model tier:** orchestrator — current-main conflict resolution may cross generated fixture boundaries.
- **Time-box:** 60 minutes.
- **Halt conditions:** Product intent changed; local commits would be lost; conflict requires deleting legacy support; unrelated mainline validation failure cannot be isolated.

## Validation gates

- Focused tests for every conflict/fixture changed
- Targeted `contract-psl` coverage and `pnpm coverage:report`
- `pnpm test:packages`
- `pnpm fixtures:check`
- `pnpm typecheck`
- `pnpm lint:deps`
- `pnpm test:integration`
- `pnpm test:e2e`
- Live-use classification
