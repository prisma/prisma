# Brief: operation-aware framework runtime and middleware contract

## Task

Refactor the family-agnostic runtime contract so callers explicitly choose a row query or a statistics execution, such that middleware interception and completion results state which operation they satisfy and no framework path can derive statement statistics from rows. Rename the framework row template to `query`, add a statistics `execute` contract, and evolve the canonical middleware lifecycle with an exhaustive operation-aware result shape while preserving ordering, abort behavior, `source`, latency, completion, `afterExecute` error handling, and fresh per-call `planExecutionId`.

## Scope

**In:** `packages/1-framework/1-core/framework-components/src/execution/**`, its runtime exports, and framework-components type/runtime tests. Tests first. The implementation representation is negotiable, but the public result contract must be explicit and exhaustive; a query intercept supplying statistics or an execute intercept supplying rows must fail loudly. Trace every changed public API through framework-components callers and tests, naming each caller's contract and how the new shape satisfies it.

**Out:** SQL and Mongo family runtime implementations; relational-core `RuntimeScope`; Supabase; ORM clients; cross-package mechanical call-site migration. Do not add compatibility aliases or optional statistics. Do not weaken the contract with `unknown`, `any`, bare casts, or optional `rows`/`stats` fields that permit both/neither.

## Completed when

- [ ] Tests pin query and statistics interception, wrong-operation rejection, completion results, source, latency/completion, abort/error behavior, and one fresh `planExecutionId` per operation call.
- [ ] The framework runtime public contract exposes row `query` and statistics `execute`, and `RuntimeCore` provides the canonical row-query lifecycle without a row-returning `execute` alias.
- [ ] `pnpm --filter @internal/framework-components build`, `typecheck`, `test`, and `lint` all pass; test compilation is included.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up message. Anything that pulls you off the goal—even if it looks useful—halts and surfaces.

## References

- Slice spec: `projects/affected-row-counts/slices/count-terminals/spec.md`
- Slice plan entry: `projects/affected-row-counts/slices/count-terminals/plan.md` § Dispatch 1
- Project spec / plan: `projects/affected-row-counts/spec.md`, `projects/affected-row-counts/plan.md`
- Review log: `projects/affected-row-counts/reviews/code-review.md` (read-only)
- Calibration: `drive/calibration/failure-modes.md` F3, F5, F14, F17, F19; `drive/calibration/grep-library.md` § Cross-cutting anti-patterns
- Prior hand-off: `projects/affected-row-counts/slices/query-execute-split/spec.md`

## Operational metadata

- **Model tier:** orchestrator — published substrate and middleware result design judgment.
- **Time-box:** 75 minutes. Overrun halts and surfaces rather than silently widening scope.
- **Halt conditions:** The operation result cannot be expressed exhaustively without weakening types; a family implementation must change to make the framework package compile; a public caller requires semantics not pinned by the slice spec; an out-of-scope surface is needed; any destructive git operation would be required. Repo-wide typecheck failures in planned downstream packages are expected and are not a halt condition.
