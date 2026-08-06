# Brief: D6 Round 3 — restore integration behavior after caller migration

## Task

Resolve the six slice-related integration failures exposed by D6 validation, such that cache tests observe the row-query driver path they exercise and nested M:N create failure still rolls back the parent plus junction under the new runtime scope contract. Preserve the settled query/statistics API; fix migration fallout, not test expectations that encode the required behavior.

## Scope

**In:** `test/integration/test/cross-package/middleware-cache.test.ts` and the smallest associated spy/helper correction; the SQL ORM nested M:N create transaction path and its focused unit/integration evidence; supporting runtime/test helper changes only when directly causal. Tests first. Reproduce focused failures before editing, identify the precise transaction regression, and search sibling mutation paths for the same class.

**Out:** The unrelated CLI init-skill cleanup timeout; API/result redesign; relaxing rollback or cache assertions; broad cleanup; fixing package-test CLI infrastructure.

## Completed when

- [ ] Five middleware-cache integration cases observe the correct driver `query` calls and retain their cache-hit/miss/rewriter discrimination.
- [ ] A nested tag create failing after parent insert rolls back parent and junction; focused test proves the failure under the regressed path and the fix covers sibling nested create/update transaction scope as applicable.
- [ ] Focused package/integration tests pass, then full `pnpm test:integration` has no slice-related failures; production build/typecheck/lint for touched packages pass. The unrelated CLI hook timeout is recorded, not fixed or marked green.

## Operational metadata

- **Model tier:** orchestrator — rollback provenance is correctness-critical; cache spy update is mechanical.
- **Time-box:** 75 minutes.
- **Halt conditions:** Restoring rollback requires a new transaction semantic; failure reproduces on current `origin/main` independently of this branch; another unrelated production surface must change; destructive git would be required.
