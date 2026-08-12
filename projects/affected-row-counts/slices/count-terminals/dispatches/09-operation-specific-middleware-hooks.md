# Dispatch 9: implement operation-specific middleware hooks

## Task

Implement the operator-approved operation-specific middleware lifecycle on top of the clean revert baseline from commit `e0ceefdaca00fba657031ed1954dbd6cd96c1d56`.

This is the replacement implementation. The amended project spec, slice spec, and design decision are authoritative.

## Scope

### In

- Replace the pre-redesign generic middleware hooks with the compatibility-free operation-specific surface:
  - Query: `beforeQuery` → `interceptQuery` → driver query → `onRow` → `afterQuery`.
  - Execute: `beforeExecute` → `interceptExecute` → driver execute → `afterExecute`.
  - SQL `beforeCompile` remains shared.
- Add public operation-specific result types:
  - `QueryInterceptResult` retains the exact pre-PR `{ rows: AsyncIterable<Record<string, unknown>> | Iterable<Record<string, unknown>> }` structure.
  - `ExecuteInterceptResult` is `{ stats: RuntimeStatementStats }`.
  - `AfterQueryResult` retains the pre-PR `{ rowCount, latencyMs, completed, source }` structure.
  - `AfterExecuteResult` contains `{ stats, latencyMs, completed: true, source }` on success and `{ latencyMs, completed: false, source }` on failure.
- Preserve pre-PR middleware control flow independently on both paths:
  - before-hooks run after lowering and before parameter encoding;
  - normal before-hook return continues, while throw aborts before interception/driver and does not invoke the after-hook;
  - interceptors run in registration order and the first non-`undefined` result wins;
  - a winning interceptor skips the matching driver terminal;
  - intercepted query rows skip `onRow`;
  - after-hooks run after driver- and middleware-sourced success and after managed intercept/driver/stream failure;
  - failure-path after-hook errors are swallowed so they do not mask the original failure;
  - success-path after-hook errors propagate.
- Remove `operation` from middleware context and all middleware result values. Do not add mismatch detection; the type and selected hook prevent wrong-result combinations.
- Wire the lifecycle through framework `RuntimeCore`, SQL runtime, prepared SQL row queries, connection and transaction scopes, Mongo runtime, and Supabase role-bound scopes.
- Preserve one per-call context reference and its abort signal, scope, `planExecutionId`, contract typing, content hashing, and family-specific param mutator across all hooks in that operation.
- Classify every existing middleware by behavior rather than mechanically renaming:
  - query-only behavior implements query hooks;
  - execute-only behavior implements execute hooks;
  - behavior intended for both assigns a shared private implementation to both operation-specific hooks;
  - `onRow` remains query-only.
- Keep cache middleware query-only using `interceptQuery`, `onRow`, and `afterQuery`; retain pre-PR cache behavior and result shape.
- Update framework and family type tests, runtime tests, cache tests, examples, integration fixtures, fakes, and downstream upgrade instructions to the approved contract.
- Retain the runtime hard cut, write-derived counts, native target semantics, and all unrelated Slice 2 behavior.

### Out

- No `ctx.operation` or result `operation` discriminator.
- No `RUNTIME.MIDDLEWARE_RESULT_MISMATCH` or equivalent runtime wrong-operation check.
- No generic `intercept`, generic completion hook, deprecated alias, compatibility overload, or fallback dispatch.
- No prepared statistics API.
- No changes to driver SPI, count semantics, control-plane APIs, contract artifacts, or unrelated cleanup.
- Do not edit project specs, plans, design decisions, review logs, trace files, or unrelated untracked orchestration paths.
- Do not amend or squash existing commits and do not push.

## Tests first

Before production edits, update or add focused tests that fail against the revert baseline and establish:

1. `interceptQuery` returns pre-PR `{ rows }`, skips the driver and `onRow`, preserves first-winner ordering, and reports middleware source through `afterQuery`.
2. `interceptExecute` returns `{ stats }`, skips the driver, preserves first-winner ordering, and reports middleware source and exact statistics through `afterExecute`.
3. Driver query and execute success invoke their matching after-hooks with exact result shapes.
4. Managed query and execute failures invoke their matching after-hooks with `completed: false`; failure-path hook errors do not replace the original error.
5. A before-hook failure does not invoke its after-hook.
6. Query hooks never run on execute and execute hooks never run on query, including prepared, connection, transaction, Mongo, and Supabase role-bound paths.
7. Middleware context and result types expose no operation discriminator; wrong result shapes fail at compile time.
8. Cache middleware remains query-only and never intercepts or stores statistics execution.
9. Per-call abort signal, scope, family-specific contract type, and `planExecutionId` remain stable through the selected lifecycle.

## Completed when

- All operation-specific hooks and result types match the amended slice spec exactly.
- The operation-discriminated implementation and its errors are absent.
- All middleware implementations and callers are semantically classified; no compatibility shims remain.
- Framework, SQL runtime, Mongo runtime, Supabase, cache middleware, affected examples, and focused integration/type tests pass.
- `pnpm typecheck`, touched-package lint, dependency lint, package tests, integration tests, E2E tests, fixture checks, error-reference coverage, and upgrade coverage pass once at dispatch close. If a broad gate cannot complete within the time-box, report it rather than claiming success.
- Changes are committed with explicit staging and DCO sign-off in coherent commits; no amend and no push.

## References

- Project spec: `projects/affected-row-counts/spec.md`
- Slice spec: `projects/affected-row-counts/slices/count-terminals/spec.md`
- Slice plan: `projects/affected-row-counts/slices/count-terminals/plan.md`
- Decision record: `projects/affected-row-counts/design-decisions.md`
- Revert baseline: `e0ceefdaca00fba657031ed1954dbd6cd96c1d56`
- Pre-PR middleware semantics: `origin/main`
- Framework middleware contract: `packages/1-framework/1-core/framework-components/src/execution/runtime-middleware.ts`
- Framework runner: `packages/1-framework/1-core/framework-components/src/execution/run-with-middleware.ts`
- Runtime core: `packages/1-framework/1-core/framework-components/src/execution/runtime-core.ts`
- SQL runtime: `packages/2-sql/5-runtime/src/sql-runtime.ts`
- Mongo runtime: `packages/2-mongo-family/7-runtime/src/mongo-runtime.ts`
- Cache middleware: `packages/3-extensions/middleware-cache/`
- Supabase runtime: `packages/3-extensions/supabase/src/runtime/supabase-runtime.ts`

## Operational metadata

- **Role variant:** `implementer/fast`
- **Model tier:** mid
- **Time-box:** 90 minutes
- **Validation budget:** selective tests during iteration; one full gate pass at completion, with only failed subsets rerun before a single confirmation pass
- **Commit:** required, DCO sign-off, explicit staging, no amend, no push

## Halt conditions

Stop and report rather than choosing a new design if:

- any existing middleware cannot be classified as query-only, execute-only, or both from its implemented behavior and tests;
- implementing the split requires an operation discriminator, generic fallback hook, or compatibility alias;
- preserving pre-PR lifecycle semantics conflicts with the approved runtime query/statistics API;
- execute interception cannot return exact statistics without fabrication;
- a family runtime or scope cannot preserve its bound queryable, abort signal, or plan execution identity;
- unrelated tracked or staged changes would be overwritten;
- a broad validation failure indicates a semantic question rather than a mechanical migration defect.

## Return shape

Return:

1. pre-implementation reconnaissance and test-first evidence;
2. decisions exercised only where the spec permitted classification;
3. commit hashes and subjects;
4. files changed grouped by framework, family runtime, middleware consumers, tests/examples, and docs;
5. exact lifecycle behavior implemented;
6. validation commands and results, distinguishing focused and broad gates;
7. residual risks, intentionally unrun gates, and any halt/deferral request;
8. no-staged-files evidence and confirmation that no compatibility surface or operation discriminator remains.
