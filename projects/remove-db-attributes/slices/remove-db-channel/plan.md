## Dispatch plan

### Dispatch 1: remove legacy interpretation and add migration diagnostics

- **Outcome:** The SQL PSL interpreter contains no native-type attribute mapping or lowering path, and red-first tests prove every `@db.X(args)` spelling fails with an actionable type-position replacement in both named-type and field position.
- **Builds on:** Slice 3's merged repository-wide migration to bare native-type constructors and the slice spec's diagnostic contract.
- **Hands to:** A hard-cut interpreter whose only knowledge of `db.` is migration-diagnostic formatting, with focused tests covering the removal boundary.
- **Focus:** Write the diagnostic expectations first; delete `NativeTypeSpec`, `NATIVE_TYPE_SPECS`, `resolveDbNativeTypeAttribute`, and `allowDbNativeType`; add the smallest shared formatter needed by named-type and field attribute validation; preserve all non-`db.` namespace behavior. Validate the contract-PSL package and symbol-deletion grep. No documentation edits.

### Dispatch 2: align durable architecture and migration guidance

- **Outcome:** ADR 241 records the accepted unified type-contribution channel, ADR 231 and every live architecture/skill/upgrade surface describe bare constructors as the only storage-type authoring channel, and historical records remain explicitly classified rather than rewritten.
- **Builds on:** Dispatch 1's implemented hard cut and exact diagnostic wording.
- **Hands to:** A repository whose durable guidance matches the interpreter and whose retained `@db.*` references have a defensible migration or historical purpose.
- **Focus:** Author ADR 241; amend ADR 231; update live examples and prose in ADR 226, ADR 239, the ecosystem extensions subsystem, current user-facing agent skills, and both current `0.16-to-0.17` upgrade instruction sets; verify whether `sql-context.ts` still needs an edit. Follow architecture-doc and no-artificial-wrap conventions. Do not rewrite old version-specific upgrade records or release history.

### Dispatch 3: exhaustive scrub and slice closure

- **Outcome:** The hard cut is repository-clean, generated fixtures are deterministic, the exhaustive reference inventory contains only intentional diagnostic/migration/history mentions, and the complete cross-package validation gate passes.
- **Builds on:** Dispatch 1's removed channel and Dispatch 2's aligned durable guidance.
- **Hands to:** A reviewable TML-2988 PR that satisfies the final slice and is ready for project retro and close-out after merge.
- **Focus:** Run fixed-string inventories for all deleted symbols and `@db.` across production, examples, docs, skills, and tests; repair only in-scope escapees; regenerate canonically if required; run focused contract-PSL tests followed by `pnpm build`, `pnpm fixtures:check`, `pnpm lint:packages`, `pnpm lint:deps`, `pnpm typecheck`, `pnpm test:packages`, `pnpm test:integration`, `pnpm test:e2e`, and `pnpm coverage:report`. Classify pre-existing timing flakes honestly; do not weaken tests or thresholds.
