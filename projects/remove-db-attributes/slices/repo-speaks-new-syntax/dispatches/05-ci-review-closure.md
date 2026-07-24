# Brief: D5 CI and review closure

## Task

Bring the existing `repo-speaks-new-syntax` implementation and PR #1036 to a mergeable state: preserve and validate the current uncommitted `Date`/`Inet` corrections, fix the failing package tests, restore `contract-psl` coverage with meaningful behavioral tests, resolve valid outstanding review findings, and reconcile the rebased local branch with the PR without beginning the slice-4 hard cut.

## Scope

**In:** The two existing uncommitted test-fixture edits; `packages/2-sql/2-authoring/contract-psl` tests needed to restore coverage; valid PR #1036 review findings in changed test or fixture files; minimal related test setup needed for current `main`; full slice validation; focused commits with explicit staging.

**Out:** Deleting `NATIVE_TYPE_SPECS`, `resolveDbNativeTypeAttribute`, or `allowDbNativeType`; implementing the final `@db.*` migration diagnostic; ADR work; lowering coverage thresholds or adding waivers; replying to GitHub comments; editing project specs, plans, traces, or review artifacts; unrelated failures already covered by active repository waivers.

## Completed when

- [ ] The two package-test failures caused by missing `Inet` expectations are fixed, and the `Date` fixture uses `pg/date@1` consistently with current `main`.
- [ ] `contract-psl` meets its existing coverage thresholds through meaningful behavioral tests; no threshold reduction, waiver, or tautological self-comparison remains.
- [ ] Every still-valid unresolved PR #1036 finding is addressed or surfaced with concrete evidence that it is stale/non-actionable.
- [ ] The complete validation gate passes and all implementation/test changes are committed with explicit staging; do not push.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up message. Anything that pulls you off the goal — even if it looks useful — halts and surfaces.

## References

- Slice spec: `projects/remove-db-attributes/slices/repo-speaks-new-syntax/spec.md`.
- Slice plan entry: `projects/remove-db-attributes/slices/repo-speaks-new-syntax/plan.md` § Dispatch 5.
- Project background: `projects/remove-db-attributes/spec.md`, `projects/remove-db-attributes/plan.md`.
- Review ledger (read-only): `projects/remove-db-attributes/reviews/code-review.md`.
- CI run: `https://github.com/prisma/prisma-next/actions/runs/30012140568`.
- PR: `https://github.com/prisma/prisma-next/pull/1036`.
- Current failures: two `packages/3-extensions/postgres/test/scalar-type-parity.test.ts` expectations omit `Inet`; coverage is below existing thresholds only for `packages/2-sql/2-authoring/contract-psl`.

## Operational metadata

- **Model tier:** orchestrator — diagnosis spans test intent, coverage restoration, review triage, and rebased-branch compatibility.
- **Time-box:** 90 minutes. Overrun halts and surfaces.
- **Halt conditions:** Any fix requires slice-4 implementation, production behavior outside the settled slice-3 design, a coverage waiver/threshold reduction, destructive loss of existing work, or touching an unrelated failing package without evidence that this branch caused it.

## Validation gates

- `pnpm test:packages`
- `pnpm coverage:packages`
- `pnpm fixtures:check`
- `pnpm typecheck`
- `pnpm lint:deps`
- `pnpm test:integration`
- `pnpm test:e2e`
