# Brief: close the runtime hard-cut migration

## Task

Mechanically migrate every remaining runtime caller, test double, type test, example, and integration helper to the settled query/statistics vocabulary, such that row work uses `query`/`queryPrepared`, statistics work uses `execute`, query and execute fake queues are distinct, no retired helper/name survives, and the workspace is green against current `origin/main` without compatibility aliases.

## Scope

**In:** Residual sites discovered by exhaustive `rg` across `packages/`, `test/`, and `examples/`, including: D2's three SQL middleware result fixtures; broad Mongo runtime row callers/tests and extension facade fakes; residual Supabase callers/fakes; SQL ORM's `executeQueryPlan` helper/name and row call sites; framework/cross-family integration tests; comments/type tests referring to retired row execution. Use grep for discovery before any broad test run. Uniformly transform according to caller contract: rows/results → query, prepared rows → queryPrepared, engine statement stats → execute. Tests/fakes model query rows and execute stats separately.

**Out:** New semantic decisions, new production features, compatibility aliases, optional/default statistics, target count normalization, docs/ADR/scorecard work owned by Slice 3, and unrelated cleanup. Any residual that cannot be classified mechanically is a halt signal.

## Completed when

- [ ] `rg '\bexecutePrepared\b|executePreparedAgainstQueryable|executeAgainstQueryable|executeQueryPlan' packages/ test/ examples/` returns zero, excluding generated/dist/node_modules; `rg 'matchingRows|countCompiled' packages/3-extensions/sql-orm-client/src/collection.ts` returns zero.
- [ ] Every row/result caller uses query, every statistics caller uses execute, and fakes expose distinct row/stat queues; no compatibility alias or result-shape inference exists. Cross-cutting banned-pattern and transient-ID scans add no hits.
- [ ] Changed exported-type producers are built before downstream validation; `pnpm typecheck`, touched-package lint, `pnpm lint:deps`, `pnpm test:packages`, `pnpm test:integration`, `pnpm test:e2e`, and `pnpm fixtures:check` pass after synchronizing current `origin/main`.
- [ ] The final diff contains no unintended fixture/generated changes and no staged/uncommitted tracked files.

## Standing instruction

This is mechanical fan-out. Stay focused on the settled contract; control scope. If any caller needs a judgment rather than the obvious row/statistics classification, halt and surface instead of inventing semantics.

## References

- Slice spec: `projects/affected-row-counts/slices/count-terminals/spec.md`
- Slice plan: `projects/affected-row-counts/slices/count-terminals/plan.md` § Dispatch 6
- Accepted implementation commits: D1 `be09058a7d`, `9c77f09bb4`; D2 `4477b0d61f`, `e014e8e540`, `12921055f6`; D3 `05878de347`, `d30196ced`; D4 `37ddc9ce0e`; D5 `9e3c93ccdd`
- Calibration: `drive/calibration/failure-modes.md` F3, F5, F8, F10, F14, F17, F19; `drive/calibration/grep-library.md` § Cross-cutting anti-patterns

## Operational metadata

- **Model tier:** mid — mechanical fan-out crossing multiple systems and invariants.
- **Time-box:** 150 minutes.
- **Halt conditions:** A caller's row/statistics contract is ambiguous; a new product/architecture decision appears; a full gate cannot be made green within settled scope; syncing `origin/main` produces a semantic conflict; an unrelated tracked change appears; destructive git would be required.
