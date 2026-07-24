## Dispatch plan

### Dispatch 1: type-position inference output

- **Outcome:** Postgres PSL inference represents and prints native storage as bare type names or constructor calls, with infer → parse → emit parity tests covering unparameterized, parameterized, `json`, and `jsonb` types.
- **Builds on:** Slice 2's contributed bare scalar constructors and the spec's chosen printer shape.
- **Hands to:** A printer that emits only the new type-position syntax.
- **Focus:** `PslTypeResolution`/printer contract, Postgres type map, print plumbing, and focused round-trip tests. No broad consumer migration.

### Dispatch 2: package and tooling consumers

- **Outcome:** Live package fixtures and tests—including contract-PSL, parser, language server, and extension contracts—speak the new syntax without weakening dotted-attribute grammar coverage.
- **Builds on:** Dispatch 1's type-position printer.
- **Hands to:** An `@db.*`-free package/tooling substrate, excluding deliberate slice-4 legacy-recognition tests.
- **Focus:** Mechanical migration under `packages/` and relevant `test/` authoring fixtures; no examples or migration-chain regeneration.

### Dispatch 3: demos, examples, and migration chains

- **Outcome:** Every app/example contract and committed migration chain speaks the new syntax and regenerates cleanly; demos and example tests pass.
- **Builds on:** Dispatch 2's migrated package substrate.
- **Hands to:** A fully migrated live repository with regenerated artifacts.
- **Focus:** `examples/`, `apps/`, Supabase/example generated contracts, migration regeneration, and example/demo validation.

### Dispatch 4: upgrade records and exhaustive scrub

- **Outcome:** Both upgrade audiences carry the source translation, the live-usage grep has only explicitly justified legacy slice-4 coverage, and all slice gates pass.
- **Builds on:** Dispatch 3's fully migrated repository.
- **Hands to:** Slice 4's hard-cut precondition: no live repository consumer depends on `@db.*`.
- **Focus:** Current-transition upgrade instructions, comment pruning, grep classification, `pnpm fixtures:check`, package/integration/example tests, typecheck, and lint.

### Dispatch 5: CI and review closure

- **Outcome:** PR #1036 is green and review-clean after reconciling the branch with current `main`, restoring contract-PSL coverage lost during legacy-test migration, and resolving valid review findings without weakening the slice's hard-cut precondition.
- **Builds on:** Dispatch 4's exhaustive scrub and the review/CI results from PR #1036.
- **Hands to:** A mergeable slice 3 and an unblocked slice 4.
- **Focus:** Existing uncommitted `Date`/`Inet` fixes, package-test and coverage failures, valid unresolved review findings, branch/upstream reconciliation, and the full slice validation gate. No deletion of the legacy `@db.*` implementation or migration-diagnostic work from slice 4.

### Dispatch 6: post-push mainline reconciliation

- **Outcome:** PR #1036 is conflict-free against the latest `main`, with any newly inherited live old-syntax fixtures migrated and the exact pushed head passing required CI.
- **Builds on:** Dispatch 5's review-clean implementation and first current-main rebase.
- **Hands to:** A mergeable PR and slice 4.
- **Focus:** The newly reported GitHub merge conflict, minimal current-main conflict resolution, affected fixture regeneration, focused validation followed by the complete gate, and push. No product-scope expansion.
