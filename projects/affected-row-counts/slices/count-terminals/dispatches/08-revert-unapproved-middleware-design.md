# Dispatch 8: revert the unapproved middleware design

## Task

Create a clean pre-redesign middleware baseline before the replacement implementation begins. Revert every middleware-related change introduced by this PR's operation-discriminated design while preserving the approved runtime `query` / `queryPrepared` / statistics `execute` split and all unrelated affected-row-count work.

This is a revert-only dispatch. Do not implement the newly approved operation-specific hook design yet.

## Scope

### In

- Compare `origin/main...HEAD` and restore the pre-PR middleware public contract and query lifecycle behavior wherever this PR changed them.
- Restore the pre-PR single-hook middleware surface: `beforeExecute`, `intercept`, `onRow`, and `afterExecute`.
- Restore pre-PR `RuntimeMiddlewareContext` without an operation discriminator.
- Restore the pre-PR row-only `InterceptResult` shape `{ rows }` and row completion result `{ rowCount, latencyMs, completed, source }`.
- Restore pre-PR query interception behavior: registration order, first non-`undefined` result wins, driver bypass, intercepted rows skip `onRow`, and after-hook success/failure behavior.
- Remove the operation-discriminated query/statistics intercept and completion machinery, including mismatch/missing-statistics framework errors introduced solely for it.
- Remove middleware participation from the new statistics `execute()` path for this baseline. Statistics execution should call the driver/runtime terminal directly after the non-middleware preparation needed to execute correctly. The next dispatch will add the approved execute-specific hooks.
- Revert cache middleware, examples, type tests, framework tests, family-runtime middleware tests, and integration middleware fixtures to their pre-PR middleware semantics, adapting only mechanical runtime row calls from the old row `execute()` name to the approved `query()` name where required.
- Remove or revert middleware-specific upgrade/error-reference wording introduced by this PR while retaining unrelated runtime split and Mongo statistics guidance.
- Preserve per-call abort propagation, codecs, marker verification, telemetry, scope routing, native affected-row counts, count terminals, Supabase behavior, and the runtime hard cut.

### Out

- Do not add `beforeQuery`, `interceptQuery`, `interceptExecute`, `afterQuery`, or the new execute-specific `afterExecute` contract yet.
- Do not amend project specs, plans, trace files, or `projects/affected-row-counts/design-decisions.md`; the orchestrator owns those.
- Do not alter unrelated implementation, tests, generated artifacts, CI configuration, or untracked orchestration paths.
- Do not add compatibility aliases or shims.
- Do not rewrite history, amend existing commits, force-push, or stage unrelated files.

## Completed when

- The diff against `origin/main` contains no operation discriminator in middleware context or middleware result values.
- The diff contains no operation-discriminated middleware mismatch/missing-statistics runner machinery.
- Query middleware behavior and result shapes match pre-PR `origin/main`, except row runtime invocations use `query()` / `queryPrepared()`.
- Statistics execution remains functional but has no middleware hooks in this revert-only baseline.
- Middleware-specific production code and focused tests compile and pass where the baseline is expected to be healthy; report any intentionally red wider checks caused by the staged hard-cut transition.
- Changes are committed with explicit staging and DCO sign-off in one focused commit.

## References

- Amended slice spec: `projects/affected-row-counts/slices/count-terminals/spec.md`
- Amended project spec: `projects/affected-row-counts/spec.md`
- Decision record: `projects/affected-row-counts/design-decisions.md`
- Pre-PR middleware source of truth: `origin/main`
- Current branch diff: `origin/main...HEAD`
- Framework middleware:
  - `packages/1-framework/1-core/framework-components/src/execution/runtime-middleware.ts`
  - `packages/1-framework/1-core/framework-components/src/execution/run-with-middleware.ts`
  - `packages/1-framework/1-core/framework-components/src/execution/runtime-core.ts`
- Cache middleware: `packages/3-extensions/middleware-cache/`
- SQL runtime: `packages/2-sql/5-runtime/`
- Mongo runtime: `packages/2-mongo-family/7-runtime/`

## Operational metadata

- **Role:** Drive implementer / Executor
- **Model tier:** orchestrator
- **Time-box:** 60 minutes
- **Validation budget:** focused framework, SQL runtime, Mongo runtime, cache middleware, and touched integration/type checks only; do not run broad workspace suites
- **Commit:** required, DCO sign-off, explicit staging, no amend

## Halt conditions

Stop and report rather than guessing if:

- reverting a middleware change would require undoing the approved runtime query/statistics API;
- a changed site cannot be classified as middleware redesign versus runtime hard cut;
- preserving functional statistics execution without middleware requires a new public design;
- unrelated tracked or staged changes would be overwritten;
- the task expands into implementation of the newly approved hook split.

## Return shape

Return:

1. commit hash and subject;
2. files changed, grouped by framework, family runtime, cache/examples, tests, and docs;
3. exact middleware behavior restored;
4. validation commands and results;
5. remaining intentional intermediate failures or risks;
6. explicit confirmation that no newly approved hook implementation was added.
