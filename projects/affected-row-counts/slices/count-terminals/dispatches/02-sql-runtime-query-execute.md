# Brief: SQL runtime query and statistics execution

## Task

Migrate the canonical SQL runtime surface to row `query`, prepared-row `queryPrepared`, and statistics-returning `execute`, such that all three scope levels share one compile/lower/encode/middleware/telemetry setup and delegate the terminal call through the supplied `SqlQueryable`. The runtime must preserve marker verification, codecs, abort phases, fresh `planExecutionId`, telemetry, and connection/transaction pinning while returning Slice 1's `SqlStatementStats` unchanged from `SqlQueryable.execute`.

## Scope

**In:** `packages/2-sql/4-lanes/relational-core/src/runtime-scope.ts` and required exports/type tests; `packages/2-sql/5-runtime/src/**`; the smallest focused SQL-runtime tests required to drive and prove the new top-level, connection, transaction, prepared-row, middleware, abort, and invalidation behavior. Tests first. Factor the shared preparation pipeline rather than copying it into query/execute variants. Trace the public runtime API through every SQL-runtime-owned caller and state how each caller's row/statistics contract is preserved.

**Out:** Supabase, SQL ORM client callers/fakes, Mongo, examples/integration fan-out, workspace-wide green. Do not add compatibility aliases, `executePrepared`, prepared statistics, target branches, SQL/AST result inference, optional statistics, bare casts, or `any`. Downstream packages remaining red is planned.

## Completed when

- [ ] Canonical `RuntimeScope`, root runtime, connection, transaction, and guarded transaction context expose row `query` and statistics `execute`; prepared rows use `queryPrepared`; post-callback statistics execution rejects before delegation.
- [ ] Query and execute share compile/lower/encode, marker, middleware context, telemetry, abort, and scope setup; their only semantic tail difference is driver `query` + decode/stream versus driver `execute` + unchanged `SqlStatementStats`.
- [ ] Relational-core and SQL-runtime production builds and lint pass after rebuilding changed exported-type producers; focused SQL-runtime tests for the new behavior pass. Remaining test/caller migration is enumerated for D6, not hidden by aliases.

## Standing instruction

Stay focused on the SQL reference implementation; control scope. Trivial-and-related fixes that serve the goal belong in this dispatch, but any need to edit another production package halts and surfaces.

## References

- Slice spec: `projects/affected-row-counts/slices/count-terminals/spec.md`
- Slice plan: `projects/affected-row-counts/slices/count-terminals/plan.md` § Dispatch 2
- D1 framework contract: commits `be09058a7d`, `9c77f09bb4`
- Slice 1 driver hand-off: `projects/affected-row-counts/slices/query-execute-split/spec.md`
- Calibration: `drive/calibration/failure-modes.md` F3, F5, F14, F17, F19; `drive/calibration/grep-library.md` § Cross-cutting anti-patterns

## Operational metadata

- **Model tier:** orchestrator — this is the lifecycle and reference-implementation judgment site.
- **Time-box:** 90 minutes.
- **Halt conditions:** Shared preparation would require behavior divergence between query and execute before the terminal; marker/middleware/telemetry semantics cannot be preserved; another production package must change; a public caller needs an unpinned semantic; destructive git would be required. Planned downstream compile failures are not halt conditions.
