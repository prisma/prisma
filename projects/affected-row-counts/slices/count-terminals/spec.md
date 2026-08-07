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

Both SQL operations share codec-registry validation, per-call abort context, fresh `planExecutionId`, marker verification, the shared SQL `beforeCompile` hook, lowering, parameter encoding, telemetry, and scope derivation. After lowering, each operation runs its own middleware lifecycle and terminal:

- `query()` runs `beforeQuery` → `interceptQuery` → `SqlQueryable.query()` → `onRow` → `afterQuery`, decodes rows, and returns `AsyncIterableResult<Row>`.
- `execute()` runs `beforeExecute` → `interceptExecute` → `SqlQueryable.execute()` → `afterExecute` and returns `SqlStatementStats`.

Connection and transaction scopes pass their pinned `SqlQueryable` into the same pipeline. `withTransaction` guards eager statistics calls before delegation just as it guards lazy row streams before and during consumption.

### Middleware hooks are operation-specific

The middleware contract exposes symmetric query and execute lifecycles rather than one operation-discriminated hook family:

```ts
interface RuntimeMiddleware {
  beforeQuery?(plan, ctx, params): void | Promise<void>;
  interceptQuery?(plan, ctx): Promise<QueryInterceptResult | undefined>;
  onRow?(row, plan, ctx): Promise<void>;
  afterQuery?(plan, result: AfterQueryResult, ctx): Promise<void>;

  beforeExecute?(plan, ctx, params): void | Promise<void>;
  interceptExecute?(plan, ctx): Promise<ExecuteInterceptResult | undefined>;
  afterExecute?(plan, result: AfterExecuteResult, ctx): Promise<void>;
}
```

`QueryInterceptResult` keeps the pre-PR query interception shape exactly: `{ rows: AsyncIterable<Record<string, unknown>> | Iterable<Record<string, unknown>> }`. `ExecuteInterceptResult` is `{ stats: RuntimeStatementStats }`. Each interceptor preserves the pre-PR control flow: middleware run in registration order, the first non-`undefined` result wins, and the matching driver terminal is skipped. `onRow` remains query-only and is not called for intercepted rows.

`beforeQuery` and `beforeExecute` preserve the pre-PR `beforeExecute` behavior on their respective paths: they run after lowering and before parameter encoding; normal return continues, while a thrown error aborts before interception or driver execution. SQL `beforeCompile` remains one shared AST-rewrite hook for both operations.

`afterQuery` preserves the pre-PR row completion shape and behavior: `{ rowCount, latencyMs, completed, source }`. `afterExecute` receives `{ stats, latencyMs, completed: true, source }` on success and `{ latencyMs, completed: false, source }` on failure. Both hooks run after driver- and middleware-sourced completion and preserve the pre-PR error rule: on a failed intercept, driver call, or row stream, after-hook errors are swallowed so they cannot mask the original error. As before, a failure in the corresponding before-hook occurs before the managed lifecycle and does not invoke the after-hook.

Hook selection carries the operation distinction, so middleware context and results carry no `operation` discriminator and the runtime needs no mismatch error. The query cache implements only query hooks. There are no compatibility aliases, deprecated hook names, or generic fallback dispatch.

### SQL count terminals use the write result directly

`updateAndCount` and `deleteAndCount` compile the same non-returning DML plans they already execute, call `RuntimeScope.execute()`, and return `stats.affectedRows`. Their primary-key `SELECT` plans and `matchingRows.length` results are removed.

The existing empty-update behavior remains: `updateAndCount({})` returns `0` without issuing a statement. For non-empty updates and all filtered deletes, the terminal issues exactly one statement.

### Mongo keeps target semantics while conforming to the vocabulary

The cross-family runtime surface uses `query()` for row/result streams and `execute()` for statistics. Mongo's count terminals stop reading `modifiedCount` / `deletedCount` from a fake result row: the Mongo runtime maps those engine-reported values to its statistics result, so `affectedRows` still means Mongo `modifiedCount` for updates and `deletedCount` for deletes. No semantic normalization is introduced—no-op Mongo updates still report zero while Postgres may count a matched row.

Other Mongo command results that are genuinely consumed as documents or command-result rows stay on `query()`. `createAndCount` remains out of scope.

### Supabase scopes expose both operations under role binding

Role-bound Supabase runtime, connection, transaction, and secondary-root scopes expose both `query()` and `execute()`. Both operations bind the role on the same connection and release or destroy it with the existing lifecycle guarantees. The raw session-control statements remain below the runtime scope and are not used as a source of ORM counts.

## Coherence rationale

This is one hard-cut migration of the runtime execution concept: the runtime and middleware contracts change together, each family and scope conforms, and the two terminals consume the new statistics operation. Operation-specific hooks make each middleware capability explicit without requiring every middleware to inspect a discriminator or accept unrelated result variants. One reviewer can hold the single invariant: callers and middleware hooks choose rows or statistics explicitly, and statistics always come from the execute operation's driver or interceptor result.

## Scope

**In:**

- Framework runtime and middleware execution contracts, including the operation-specific before, intercept, and after hook pairs.
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
| Middleware supplies the wrong result kind | Prevent by construction | `interceptQuery` can return only `{ rows }`; `interceptExecute` can return only `{ stats }`. The runtime never converts between them. |
| Empty `updateAndCount({})` | Preserve zero-statement no-op | It returns `0`; the one-statement condition applies when a write is issued. |
| Count terminal inside `db.transaction(...)` | Use the pinned transaction scope | `execute()` delegates to the transaction's `SqlQueryable`, not the pool-level driver. |
| Transaction context used after callback completion | Reject before an eager statistics call | Lazy query streams retain their existing before/during-consumption guard. |
| Interleaving regression test recurses through middleware | Use a one-shot guard and independent runtime | The injected write must commit before the terminal's write and must not re-enter the observing middleware. |
| Mongo no-op update | Preserve `modifiedCount` semantics | The runtime exposes the engine value; it does not translate it to matched-row semantics. |

## Slice-specific done conditions

- [ ] `updateAndCount` and `deleteAndCount` issue one statement when a write is issued, proven through middleware observation.
- [ ] An integration test inserts a newly matching row immediately before the write and proves the returned count includes it.
- [ ] No SQL runtime row caller uses `execute` or `executePrepared`; `query` / `queryPrepared` are the only row operation names.
- [ ] `interceptQuery` retains the pre-PR `{ rows }` contract, `interceptExecute` supplies `{ stats }`, and no path derives `affectedRows` from intercepted rows.
- [ ] SQL transaction and Supabase role-bound scopes have tests proving statistics execution stays on the bound connection.
- [ ] `pnpm test:integration` and `pnpm test:e2e` pass against both shipped SQL drivers where the existing harness provides coverage.

## Contract impact

None. Contract entities, capabilities, `contract.json`, and `contract.d.ts` are unchanged.

## Adapter impact

- **Postgres / SQLite drivers:** unchanged; the runtime consumes Slice 1's `SqlQueryable.execute()` result.
- **Supabase:** role-bound runtime scopes gain explicit query/statistics methods while retaining connection cleanup behavior.
- **Mongo:** runtime and ORM adopt explicit query/statistics vocabulary without changing Mongo's modified/deleted count semantics.

## Open Questions

None. The operator settled the runtime vocabulary on 2026-08-06 and the operation-specific middleware lifecycle on 2026-08-07. The middleware split is a compatibility-free hard cut.

## References

- Parent project: `projects/affected-row-counts/spec.md`
- Linear issue: [TML-3168](https://linear.app/prisma-company/issue/TML-3168)
- Slice 1 hand-off: `projects/affected-row-counts/slices/query-execute-split/spec.md`
- [ADR 023 — Budget Evaluation](../../../../docs/architecture%20docs/adrs/ADR%20023%20-%20Budget%20Evaluation.md)
- [ADR 220 — Runtime `planExecutionId`](../../../../docs/architecture%20docs/adrs/)
