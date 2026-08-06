# Slice: count-terminals

Parent project: `projects/affected-row-counts/`. This slice consumes Slice 1's driver statistics and delivers the project's user-visible purpose: count-returning writes report the count from the write itself.

## At a glance

The runtime adopts the same explicit vocabulary as the driver: `query()` streams rows, `queryPrepared()` streams prepared rows, and `execute()` returns statement statistics. `updateAndCount` and `deleteAndCount` then issue one write statement and return its `affectedRows`; the pre-`SELECT` path is deleted.

## Chosen design

### Runtime operations are selected by the caller

SQL runtime scopes expose two semantic operations:

```ts
interface RuntimeScope {
  query<Row>(plan: SqlOrmPlan<Row>, options?: RuntimeExecuteOptions): AsyncIterableResult<Row>;
  execute(plan: SqlOrmPlan, options?: RuntimeExecuteOptions): Promise<SqlStatementStats>;
}
```

The current row-returning `executePrepared(statement, params, options)` becomes `queryPrepared(statement, params, options)`. This slice does not add a statistics-returning prepared operation: there is no prepared count caller yet, and adding one speculatively would recreate the four-method surface Slice 1 removed at the driver boundary.

The operation is explicit at the call site. The runtime does not infer row-versus-statistics behavior from SQL text, AST node kinds, the plan's row generic, or `SqlQueryPlan` versus `SqlExecutionPlan`; those plan types describe lowering state, not result semantics.

### One preparation pipeline, two terminal calls

Both SQL operations share the existing pre-driver pipeline: codec-registry validation, per-call abort context, fresh `planExecutionId`, marker verification, `beforeCompile`, lowering, `beforeExecute`, parameter encoding, middleware intercept, telemetry, and scope derivation. Only the terminal differs:

- `query()` calls `SqlQueryable.query()`, decodes rows, and returns `AsyncIterableResult<Row>`.
- `execute()` calls `SqlQueryable.execute()` and returns its `SqlStatementStats` unchanged.

Connection and transaction scopes pass their pinned `SqlQueryable` into the same pipeline. `withTransaction` guards eager statistics calls before delegation just as it guards lazy row streams before and during consumption.

### Middleware results state which operation they satisfy

The middleware result contract becomes operation-discriminated. A query intercept supplies rows; an execute intercept supplies statement statistics. The runtime rejects a result for the wrong operation rather than deriving `affectedRows` from row length or accepting a row-shaped cache hit as a write count.

`afterExecute` receives the corresponding operation result: query completion reports `rowCount`; statistics completion reports the explicit statement statistics. Both variants retain `latencyMs`, `completed`, and `source`. Existing query cache middleware remains query-only and passes through statistics operations. This keeps `beforeExecute`, `intercept`, `afterExecute`, abort behavior, and telemetry available to writes without fabricating a count.

### SQL count terminals use the write result directly

`updateAndCount` and `deleteAndCount` compile the same non-returning DML plans they already execute, call `RuntimeScope.execute()`, and return `stats.affectedRows`. Their primary-key `SELECT` plans and `matchingRows.length` results are removed.

The existing empty-update behavior remains: `updateAndCount({})` returns `0` without issuing a statement. For non-empty updates and all filtered deletes, the terminal issues exactly one statement.

### Mongo keeps target semantics while conforming to the vocabulary

The cross-family runtime surface uses `query()` for row/result streams and `execute()` for statistics. Mongo's count terminals stop reading `modifiedCount` / `deletedCount` from a fake result row: the Mongo runtime maps those engine-reported values to its statistics result, so `affectedRows` still means Mongo `modifiedCount` for updates and `deletedCount` for deletes. No semantic normalization is introduced—no-op Mongo updates still report zero while Postgres may count a matched row.

Other Mongo command results that are genuinely consumed as documents or command-result rows stay on `query()`. `createAndCount` remains out of scope.

### Supabase scopes expose both operations under role binding

Role-bound Supabase runtime, connection, transaction, and secondary-root scopes expose both `query()` and `execute()`. Both operations bind the role on the same connection and release or destroy it with the existing lifecycle guarantees. The raw session-control statements remain below the runtime scope and are not used as a source of ORM counts.

## Coherence rationale

This is one hard-cut migration of the runtime execution concept: the shared runtime/middleware contract changes, each family and scope conforms, and the two terminals consume the new statistics operation. Splitting the runtime rename from the terminals would ship a public vocabulary change with no consumer value; splitting the terminals from middleware would permit an intercepted write to return a made-up count. One reviewer can hold the single invariant: callers choose rows or statistics explicitly, and statistics always come from that operation's result.

## Scope

**In:**

- Framework runtime and middleware execution contracts, including operation-discriminated intercept and `afterExecute` results.
- SQL `RuntimeScope`, top-level runtime, connection, transaction, prepared-row API, `withTransaction`, and tests/fakes.
- Mongo runtime vocabulary and the existing `updateAndCount` / `deleteAndCount` count extraction path.
- Supabase role-bound runtime, connection, transaction, secondary-root scopes, and their tests.
- SQL ORM row-plan helper/callers, `updateAndCount`, `deleteAndCount`, and affected tests/fakes.
- Integration evidence for one statement and write-derived count.

**Out:**

- Driver SPI changes; Slice 1 already delivered `SqlQueryable.query()` / `execute()`.
- `createAndCount` and any prepared statistics method.
- Streaming `RETURNING` terminals (`update`, `updateAll`, `createAll`, `delete`, `deleteAll`).
- Inferring operation kind from SQL or plan shape.
- Reconciling target count semantics.
- ADR and scorecard edits; Slice 3 (`count-semantics`, TML-3169) owns them.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| Middleware intercept returns rows for `execute()` or statistics for `query()` | Fail loudly | The runtime never converts row count into `affectedRows` and never discards supplied statistics to synthesize rows. |
| Empty `updateAndCount({})` | Preserve zero-statement no-op | It returns `0`; the one-statement condition applies when a write is issued. |
| Count terminal inside `db.transaction(...)` | Use the pinned transaction scope | `execute()` delegates to the transaction's `SqlQueryable`, not the pool-level driver. |
| Transaction context used after callback completion | Reject before an eager statistics call | Lazy query streams retain their existing before/during-consumption guard. |
| Interleaving regression test recurses through middleware | Use a one-shot guard and independent runtime | The injected write must commit before the terminal's write and must not re-enter the observing middleware. |
| Mongo no-op update | Preserve `modifiedCount` semantics | The runtime exposes the engine value; it does not translate it to matched-row semantics. |

## Slice-specific done conditions

- [ ] `updateAndCount` and `deleteAndCount` issue one statement when a write is issued, proven through middleware observation.
- [ ] An integration test inserts a newly matching row immediately before the write and proves the returned count includes it.
- [ ] No SQL runtime row caller uses `execute` or `executePrepared`; `query` / `queryPrepared` are the only row operation names.
- [ ] A statistics-shaped middleware intercept must supply statistics; no path derives `affectedRows` from intercepted rows.
- [ ] SQL transaction and Supabase role-bound scopes have tests proving statistics execution stays on the bound connection.
- [ ] `pnpm test:integration` and `pnpm test:e2e` pass against both shipped SQL drivers where the existing harness provides coverage.

## Contract impact

None. Contract entities, capabilities, `contract.json`, and `contract.d.ts` are unchanged.

## Adapter impact

- **Postgres / SQLite drivers:** unchanged; the runtime consumes Slice 1's `SqlQueryable.execute()` result.
- **Supabase:** role-bound runtime scopes gain explicit query/statistics methods while retaining connection cleanup behavior.
- **Mongo:** runtime and ORM adopt explicit query/statistics vocabulary without changing Mongo's modified/deleted count semantics.

## Open Questions

None. The operator settled the runtime vocabulary on 2026-08-06 in the project spec. The representation of the discriminated middleware result is an implementation degree of freedom provided it is exhaustive, type-safe, and rejects operation mismatches.

## References

- Parent project: `projects/affected-row-counts/spec.md`
- Linear issue: [TML-3168](https://linear.app/prisma-company/issue/TML-3168)
- Slice 1 hand-off: `projects/affected-row-counts/slices/query-execute-split/spec.md`
- [ADR 023 — Budget Evaluation](../../../../docs/architecture%20docs/adrs/ADR%20023%20-%20Budget%20Evaluation.md)
- [ADR 220 — Runtime `planExecutionId`](../../../../docs/architecture%20docs/adrs/)
