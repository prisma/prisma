# Brief: D3 exhaustive scrub and slice closure

## Task

Prove the hard cut is repository-clean and validation-complete. Inventory every deleted symbol and `@db.` reference across live production, tests, examples, documentation, skills, and upgrade records; repair only in-scope escapees; regenerate committed fixtures canonically if required; and run the complete cross-package gate on the current `origin/main` base.

## Scope

**In:** Fixed-string repository inventories for `NativeTypeSpec`, `NATIVE_TYPE_SPECS`, `resolveDbNativeTypeAttribute`, `allowDbNativeType`, and `@db.`; classification of every retained `@db.` hit as migration diagnostic/current upgrade help or explicitly historical evidence; in-scope repairs discovered by the inventory; canonical fixture regeneration only when `pnpm fixtures:check` proves it necessary; the complete validation matrix named below; current-main ancestry verification.

**Out:** Rewriting old release notes or old version-specific upgrade records merely because they contain historical `@db.*`; changing unrelated database hostnames such as `@db.internal`; unrelated lint/test cleanup; weakening tests, coverage thresholds, lints, or dependency rules; new feature work; project retro/close-out.

## Completed when

- [ ] Deleted-symbol inventory has no production references; any retained test/document references are intentionally about removal and are explicitly classified in the report.
- [ ] Every repository `@db.` hit is classified. Live authoring examples and current guidance contain no recommendation to use the removed channel; retained hits are migration diagnostics, current rewrite guidance/detection, immutable historical evidence, or unrelated literal data such as `@db.internal`.
- [ ] `pnpm fixtures:check` is deterministic; if it initially fails because this slice changes generated output, regeneration uses the repository's canonical command and the resulting artifacts are explicitly staged and committed.
- [ ] `pnpm build`, `pnpm fixtures:check`, `pnpm lint:packages`, `pnpm lint:deps`, `pnpm typecheck`, `pnpm test:packages`, `pnpm test:integration`, `pnpm test:e2e`, and `pnpm coverage:report` all pass on a branch with zero commits behind current `origin/main`.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up message. Anything that pulls you off the goal — even if it looks useful — halts and surfaces.

## References

- Slice spec: `projects/remove-db-attributes/slices/remove-db-channel/spec.md` — final done conditions and historical exemptions.
- Slice plan entry: `projects/remove-db-attributes/slices/remove-db-channel/plan.md` § Dispatch 3.
- D1 hard cut: `dff7cb15c60a520179b86b2f0055da6c53e81718`.
- D2 architecture/guidance: `003bfdf0b38a1c97413d938d1a45740806b52746`, repaired by `f6a87859df5ccfd401383f3d01ae9b66c1318630`.
- Latest pre-dispatch `origin/main` reconciliation reported 0 commits behind and 4 commits ahead before the project-ledger checkpoint.

## Validation gates

Run once after inventory repairs are complete, in this order:

1. `pnpm build`
2. `pnpm fixtures:check`
3. `pnpm lint:packages`
4. `pnpm lint:deps`
5. `pnpm typecheck`
6. `pnpm test:packages`
7. `pnpm test:integration`
8. `pnpm test:e2e`
9. `pnpm coverage:report`

Also run fixed-string `rg` inventories for each deleted symbol and `@db.` before the matrix, and `git diff --check` plus current-main ancestry verification after it. If a gate fails, diagnose whether it is slice-caused or pre-existing; fix only in-scope regressions, rerun the failed focused gate, then rerun the full matrix once more. Never call a skipped or unavailable gate green.

## Operational metadata

- **Model tier:** `implementer/fast` (`mid`) — broad but mechanical inventory and validation with no open design choices.
- **Time-box:** 120 minutes. Long gates run in the foreground with heartbeats before and after; overrun or stale progress halts and surfaces.
- **Halt conditions:** The branch is behind `origin/main`; an inventory escapee requires out-of-scope historical rewriting; canonical regeneration is ambiguous; a full gate cannot pass without unrelated code changes or threshold weakening; infrastructure prevents an honest gate result; or a slice assumption is false.

## Constraints

- Use shell `rg` fixed-string inventories, not editor regex search.
- Explicit staging only; no amend; no push.
- If no repair or generated artifact changes are needed, create no empty implementation commit.
- If repairs are required, commit them coherently with sign-off before the final matrix.
- Do not edit project spec, plan, trace, dispatch briefs, or review artifacts.
- Do not touch or stage unrelated untracked `agent/` or `skills/*` paths.