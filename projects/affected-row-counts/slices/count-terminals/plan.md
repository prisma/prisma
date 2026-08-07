# Slice `count-terminals` — Dispatch plan

**Slice spec:** `projects/affected-row-counts/slices/count-terminals/spec.md`
**Linear:** [TML-3168](https://linear.app/prisma-company/issue/TML-3168)

## Shape

Seven sequential dispatches deliver a hard-cut runtime migration: framework contract → SQL reference implementation → Mongo conformance → Supabase scopes → count-terminal consumer → mechanical fan-out and closing gates → downstream upgrade instructions.

**Expected intermediate state: repo-wide `pnpm typecheck` may be red from D1 through D5.** Renaming the cross-family row operation and changing `RuntimeScope` invalidates family runtimes, scopes, callers, and test doubles together. Each dispatch gates its owned production package(s); D6 owns workspace-wide green. This is the same hard-cut migration shape Slice 1 used successfully.

Every dispatch inherits these execution constraints:

- Tests are written or updated before implementation, per repository policy.
- Use `rg` to enumerate callers before editing and use test suites as verification, not discovery ([`failure-modes.md` F3](../../../../drive/calibration/failure-modes.md)).
- Destructive git operations are forbidden without orchestrator approval ([F5](../../../../drive/calibration/failure-modes.md)).
- The brief states the architectural property, not only the rename mechanic ([F17](../../../../drive/calibration/failure-modes.md)); reviewers trace every public API change through all callers ([F19](../../../../drive/calibration/failure-modes.md)).
- Package lint and test-project typecheck mirror CI ([F14](../../../../drive/calibration/failure-modes.md)).
- Behavioral count claims are verified through populated fixtures, not code reading ([F15](../../../../drive/calibration/failure-modes.md)).
- Relevant closing greps come from [`grep-library.md` § Cross-cutting anti-patterns](../../../../drive/calibration/grep-library.md#cross-cutting-anti-patterns), plus the slice-specific retired-name gates below.

### Dispatch 1: operation-specific framework runtime and middleware contract

- **Outcome:** The family-agnostic runtime contract distinguishes row queries from statistics executions through symmetric, operation-specific middleware hooks, such that each hook has one truthful result type and no framework path can derive `affectedRows` from rows.
- **Builds on:** Slice 1's settled `query` / `execute` driver vocabulary and the operator-settled middleware lifecycle in the amended slice spec.
- **Hands to:** A typed framework substrate on which SQL and Mongo runtimes can implement explicit query/statistics operations while preserving the pre-PR lifecycle semantics on both paths.
- **Focus:** First revert the current PR's operation-discriminated middleware design to a clean pre-PR baseline without undoing the runtime query/statistics split. Then implement `beforeQuery` / `interceptQuery` / `afterQuery` and `beforeExecute` / `interceptExecute` / `afterExecute`; keep `onRow` query-only and SQL `beforeCompile` shared. Preserve the pre-PR `{ rows }` query-intercept shape and add `{ stats }` for execute interception. Preserve registration order, first-interceptor-wins, driver bypass, source, latency, completion, failure-path after-hook error handling, abort, and `planExecutionId`. Remove operation discriminators and mismatch errors. Add no compatibility shims. Gate: build, typecheck (including tests), test, and lint for `@internal/framework-components`. Model tier: orchestrator because this is a published substrate correction. Deliberately out of scope: family runtimes and their callers.

### Dispatch 2: SQL runtime exposes query and statistics end to end

- **Outcome:** SQL runtime, connection, transaction, and guarded transaction context expose `query`, `queryPrepared`, and statistics-returning `execute`, such that both operations share one compile/lower/encode/middleware/telemetry setup and delegate through the supplied `SqlQueryable`.
- **Builds on:** D1's operation-specific framework contract and Slice 1's `SqlQueryable.query` / `execute` implementation.
- **Hands to:** The canonical SQL `RuntimeScope` shape with every native SQL scope able to stream rows or return real statement statistics on its bound driver/connection/transaction.
- **Focus:** `sql-relational-core` runtime scope/types and `sql-runtime` production code. Rename the row helper/API rather than retaining compatibility aliases; prepared rows become `queryPrepared`; no prepared statistics method. Preserve marker verification, codecs, abort phases, telemetry, fresh `planExecutionId`, and post-callback transaction invalidation. Model tier: orchestrator, because this is the reference implementation and lifecycle judgment site. Gate: build the changed exported-type producers, then production-source typecheck/build plus package lint for relational-core and SQL runtime; D6 owns the still-invalid test tree. Deliberately out of scope: Supabase, ORM callers, and mechanical test fakes.

### Dispatch 3: Mongo adopts explicit row/statistics operations

- **Outcome:** Mongo runtime and ORM use `query` for row/result streams and `execute` for update/delete statistics, such that update counts remain `modifiedCount`, delete counts remain `deletedCount`, and the existing fake-row casts in `updateAndCount` / `deleteAndCount` disappear.
- **Builds on:** D1's cross-family contract and operation-specific middleware lifecycle.
- **Hands to:** Both runtime families conforming to the same caller-selected vocabulary without normalizing their target-specific count semantics.
- **Focus:** Mongo runtime, query executor, and count terminals. Preserve middleware, codec, abort, and result-shape behavior for row queries. Other command-result consumers, including `createAndCount`, remain row-query consumers per the slice non-goals. Model tier: orchestrator, because command/result classification and target semantics are judgment-heavy. Gate: Mongo runtime and Mongo ORM build/typecheck, focused count/runtime tests, and package lint; wider Mongo test-literal fan-out may defer to D6 only when it is a uniform rename. Halt if supporting statistics requires inferring intent from a raw command whose caller did not choose the operation.

### Dispatch 4: Supabase role-bound scopes conform

- **Outcome:** Every Supabase app-role and secondary-root scope exposes row `query` and statistics `execute`, such that role binding, same-connection execution, transaction pinning, reset-before-release, and destroy-on-error guarantees hold for both operations.
- **Builds on:** D2's SQL runtime scope and helpers.
- **Hands to:** All production SQL runtime scopes conforming; only SQL ORM consumers and mechanical test doubles remain.
- **Focus:** Supabase runtime/facade production code and focused lifecycle tests. Keep raw session-control statements below the runtime API; they are not an ORM count source. Model tier: mid, because the reference pattern exists but connection cleanup remains load-bearing. Gate: Supabase build/typecheck/test/lint. Deliberately out of scope: SQL ORM terminal behavior.

### Dispatch 5: count terminals consume the write statistics

- **Outcome:** SQL `updateAndCount` and `deleteAndCount` issue one DML statement and return its `affectedRows`, such that annotations stay on the write, transaction scope stays pinned, and an interleaved newly matching row is included in the returned count.
- **Builds on:** D2's SQL `RuntimeScope.execute` and D4's complete production scope set.
- **Hands to:** The project's user-visible purpose delivered in production code with focused unit and real-driver evidence; only mechanical caller/fake cleanup and workspace gates remain.
- **Focus:** Write tests first. Delete the primary-key `compileSelect` / `matchingRows.length` path, route both compiled non-returning plans through statistics execution, and preserve the empty-update zero-statement no-op. Add middleware-observed one-statement tests and an independent-runtime, one-shot interleaving integration fixture that fails under the old read-then-write implementation. Update annotation tests to prove the one execution is the annotated write. Model tier: orchestrator, because the integration seam and behavioral proof are judgment sites. Gate: SQL ORM build/typecheck/focused tests/lint plus the relevant Postgres and SQLite integration tests. Deliberately out of scope: `createAndCount` and returning terminals.

### Dispatch 6: mechanical fan-out closes the hard-cut gate

- **Outcome:** Every remaining runtime caller, test double, type test, example, and integration helper conforms to the settled query/statistics vocabulary, and all slice and workspace gates are green.
- **Builds on:** The union of D1–D5: settled framework contract, both families, every production SQL scope, and count-terminal behavior.
- **Hands to:** A compatibility-free implementation whose downstream source translation can be published.
- **Focus:** Uniformly migrate residual row `execute` / `executePrepared` sites to `query` / `queryPrepared`; update fake queues so query rows and execute statistics are distinct; do not introduce compatibility aliases. This is a mechanical fan-out—any site requiring a new semantic choice is a halt signal. Model tier: mid because the fan-out crosses multiple packages and must preserve cross-family invariants. Closing greps:
  - `rg '\bexecutePrepared\b|executePreparedAgainstQueryable|executeAgainstQueryable|executeQueryPlan' packages/ test/` returns zero.
  - `rg 'matchingRows|countCompiled' packages/3-extensions/sql-orm-client/src/collection.ts` returns zero.
  - Cross-cutting banned-pattern greps add no new hits.
  Gate: build changed exported-type producers before downstream checks; `pnpm typecheck`; touched-package lint; `pnpm lint:deps`; `pnpm test:packages`; `pnpm test:integration`; `pnpm test:e2e`; `pnpm fixtures:check` because the slice touches extensions (expected no fixture delta). Re-fetch and sync `origin/main`, then repeat always-run and affected integration gates before push.

### Dispatch 7: publish the hard-cut source translation

- **Outcome:** The 0.17 → 0.18 user and extension-author upgrade skills tell downstream agents how to classify and migrate row queries, prepared rows, statistics execution, middleware results, and the removed Mongo facade row executor without adding compatibility aliases.
- **Builds on:** D6's complete examples and extension substrate diff, which is the post-upgrade reference state.
- **Hands to:** PR-open readiness with the repository's breaking-change upgrade-coverage contract satisfied.
- **Focus:** Amend the actionable `runtime-query-execute-hard-cut` change in each upgrade path. User instructions cover runtime `query` / `queryPrepared` / statistics `execute` and the Mongo facade route through `runtime().query`; extension-author instructions additionally cover the operation-specific hook migration and row/statistics fakes. Use detection broad enough to find retired runtime and middleware calls but prose that requires semantic classification; do not publish an unsafe global codemod. Model tier: mid because the translation spans two audiences but all decisions are settled. Gate: validate both entries against their corresponding in-repo substrate per `record-upgrade-instructions`, run `pnpm check:upgrade-coverage`, skill lint, and ensure the PR body names both entry directories.

## Handoff linearity

D1 → D2 → D3 → D4 → D5 → D6 → D7 is sequential. D3 depends directly on D1 rather than D2's SQL implementation; its brief needs D1's framework contract, not SQL-specific mechanics. D4 and D5 depend on D2. D6 depends on the union of all prior dispatches and must receive each operation's settled caller contract, not only D5's terminal diff.

## Slice-DoD reachability

| Slice-DoD condition | Closed by |
| --- | --- |
| One statement per non-empty count terminal | D5 behavior tests · D6 integration gate |
| Interleaved write reflected in returned count | D5 real-driver fixture |
| No SQL row caller uses retired runtime names | D2 production · D4/D5 consumers · D6 closing grep |
| `interceptExecute` supplies statistics without row conversion | D1 contract/tests · D2 runtime use |
| Bound SQL transaction and Supabase scope preserved | D2 transaction tests · D4 role-bound tests |
| Integration/e2e green | D6 closing gates |
| Downstream breaking-change translation recorded | D7 user and extension-author upgrade entries |

## Open items

None. The operator-settled operation-specific hook contract supersedes the earlier agent-authored operation-discriminated design. Any implementation pressure to reintroduce a discriminator, compatibility shim, or generic fallback hook is a halt signal.
