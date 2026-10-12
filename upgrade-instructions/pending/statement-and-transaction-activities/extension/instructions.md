---
changes:
  - id: middleware-hooks-are-activity-hooks
    summary: |
      The per-statement middleware hooks are replaced. `beforeQuery` and `beforeExecute` become `beforeEncode`; `interceptQuery` and `interceptExecute` become `intercept.onQuery` and `intercept.onExecute`; `afterQuery` and `afterExecute` become `activityEnded` on a statement; `afterTransaction` becomes `activityFinalized` on a statement. `onRow` and `beforeCompile` are unchanged.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\b(beforeQuery|beforeExecute|interceptQuery|interceptExecute|afterQuery|afterExecute|afterTransaction)\b'
  - id: middleware-context-is-activity-context
    summary: |
      `RuntimeMiddlewareContext` is renamed `ActivityContext`. It gains `parent`, `state(key)` and `inTransaction()`, and loses `planExecutionId`; use `activity.id` instead.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bRuntimeMiddlewareContext\b'
        - '\bplanExecutionId\b'
  - id: after-result-types-removed
    summary: |
      `AfterQueryResult`, `AfterExecuteResult` and `AfterTransactionResult` are removed. Use `ActivityEndedResult` (narrow it with `result.kind === 'statement'` and `result.returns`) and `ActivityFinalizedResult`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bAfter(Query|Execute|Transaction)Result\b'
  - id: aborted-phase-before-encode
    summary: |
      A `RUNTIME.ABORTED` error raised during the middleware stage before encoding reports `details.phase: 'beforeEncode'`, not `'beforeQuery'` or `'beforeExecute'`. The phases `'afterQuery'` and `'afterExecute'` no longer occur.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '[''"`](beforeQuery|beforeExecute|afterQuery|afterExecute)[''"`]'
  - id: every-started-statement-is-ended-and-finalized
    summary: |
      Every statement the runtime accepts now starts an activity, and every started statement ends and is finalized exactly once. A call with an already-aborted signal fires `activityStarted` before it fails. A statement that fails before it runs, in `beforeCompile`, `beforeEncode` or parameter encoding, now ends `failed` and is finalized, where it got no `afterTransaction` before.
  - id: observed-row-budget-runs
    summary: |
      The `budgets()` middleware now counts the rows a query returns and enforces `maxRows` on them. Before, the observed-row check never ran. With the default row severity `'error'`, or in `strict` mode, a query that returns more than `maxRows` rows fails with `BUDGET.ROWS_EXCEEDED`; with `'warn'` in `permissive` mode it logs one warning for the statement and keeps streaming.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bbudgets\('
  - id: statement-runners-replace-middleware-runners
    summary: |
      `runBeforeQueryChain`, `runBeforeExecuteChain`, `runQueryWithMiddleware`, `runExecuteWithMiddleware`, `runAfterTransaction`, `reportQueryEnding`, `reportExecuteEnding`, `onQueryEndOutsideTransaction` and `QueryEnding` are removed from `@prisma/orm-framework`. A runtime runs a statement with `streamStatement` or `executeStatement`, whose body calls `beforeEncode`, `runQuery` and `runExecute`, and opens a transaction with `startTransactionActivity`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\b(runBeforeQueryChain|runBeforeExecuteChain|runQueryWithMiddleware|runExecuteWithMiddleware|runAfterTransaction|reportQueryEnding|reportExecuteEnding|onQueryEndOutsideTransaction|QueryEnding|afterTransactionStageFor|anyMiddlewareDeclaresAfterTransaction)\b'
  - id: runtime-core-context-fields
    summary: |
      `RuntimeCoreOptions.ctx` is an `ActivityContextFields`: the context fields without `parent`, `state` and `inTransaction`, and without `planExecutionId`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bplanExecutionId\s*:'
  - id: begin-transaction-on
    summary: |
      `SqlRuntimeBase.wrapTransaction(driverTx, connection)` is replaced by `beginTransactionOn(connection)`, which starts the transaction activity, runs `BEGIN` on the connection and returns the wrapped transaction.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bwrapTransaction\s*\('
  - id: middleware-debug-events-renamed
    summary: |
      The runtime's debug events `middleware.interceptQuery` and `middleware.interceptExecute` are now `middleware.intercept.onQuery` and `middleware.intercept.onExecute`, and the logged error event `middleware.afterTransaction.error` is now `middleware.activityFinalized.error`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - 'middleware\.(interceptQuery|interceptExecute|afterTransaction\.error)'
---

# Middleware hooks are activity hooks

The runtime now runs every statement and every transaction as an **activity**. A middleware observes an activity through three lifecycle events, `activityStarted`, `activityEnded` and `activityFinalized`, and changes or stops a statement through interceptors: `beforeEncode`, `intercept.onQuery`, `intercept.onExecute` and `onRow`. The per-statement hooks are gone.

## Rename the hooks

| Before | After |
|---|---|
| `beforeQuery`, `beforeExecute` | `beforeEncode` |
| `interceptQuery`, `interceptExecute` | `intercept.onQuery`, `intercept.onExecute` |
| `onRow` | `onRow` |
| `afterQuery`, `afterExecute` | `activityEnded` on a statement |
| `afterTransaction` | `activityFinalized` on a statement |
| `beforeCompile` | `beforeCompile` |

`beforeEncode` keeps the arguments of `beforeQuery` and `beforeExecute`: the lowered plan, the context and the parameter mutator. It runs for both `query()` and `execute()`. A middleware that defined both `beforeQuery` and `beforeExecute` with the same body defines `beforeEncode` once. A middleware that must tell them apart reads `activity.returns` (`'rows'` or `'stats'`) in `activityStarted` and keeps it in `ctx.state`.

The interceptors move under one `intercept` object:

```diff
- async interceptQuery(plan, ctx) {
-   return { rows: cached };
- },
+ intercept: {
+   async onQuery(plan, ctx) {
+     return { rows: cached };
+   },
+ },
```

## Read the result from `activityEnded`

`afterQuery(plan, result, ctx)` and `afterExecute(plan, result, ctx)` become one hook, `activityEnded(activity, result, ctx)`. It fires for transactions too, so check the kind first. `result.completed` is replaced by `result.outcome`, which is `'succeeded'`, `'failed'` or `'stopped'` (the caller stopped reading the rows). `latencyMs` and `source` are unchanged; `rowCount` or `stats` is there according to `result.returns`. The plan the caller sent is `activity.plan`; the lowered SQL is not on the activity, so a middleware that logs it keeps it from `beforeEncode` in `ctx.state`:

```diff
- async afterQuery(plan, result, ctx) {
-   if (result.latencyMs > 250) ctx.log.warn({ sql: plan.sql, rowCount: result.rowCount });
- },
+ async beforeEncode(plan, ctx) {
+   ctx.state(sqlKey)['sql'] = plan.sql;
+ },
+ async activityEnded(activity, result, ctx) {
+   if (result.kind !== 'statement' || result.latencyMs <= 250) return;
+   ctx.log.warn({
+     sql: ctx.state(sqlKey)['sql'],
+     ...(result.returns === 'rows' ? { rowCount: result.rowCount } : {}),
+   });
+ },
```

`sqlKey` is a module-level `Symbol()`. An error thrown from `activityEnded` after a successful statement still fails it and reaches the caller, as an error from `afterQuery` did.

## Replace `afterTransaction` with `activityFinalized`

`afterTransaction(plan, result, ctx)` becomes `activityFinalized(activity, result, ctx)`. `result.outcome` keeps its three values, `'committed'`, `'rolled-back'` and `'unknown'`, and the same rules decide it. An error thrown from it is still logged and swallowed. It also fires for transactions, after their statements, so a middleware that acts on statements checks `activity.kind === 'statement'`. A statement that fails before it runs, in `beforeCompile`, `beforeEncode` or parameter encoding, is now finalized too: `unknown` outside a transaction, and with the transaction's outcome inside one.

## Rename the context type and the execution id

`RuntimeMiddlewareContext` is now `ActivityContext`, and `SqlMiddlewareContext` and `MongoMiddlewareContext` extend it. `ctx.planExecutionId` is removed; use `activity.id`, a fresh id for each activity that every hook of the activity sees. Keep per-statement state in `ctx.state(key)` instead of a `WeakMap` keyed by the plan: each activity has its own state, and middleware that use the same key share the object. `AfterQueryResult`, `AfterExecuteResult` and `AfterTransactionResult` are removed; use `ActivityEndedResult` and `ActivityFinalizedResult`.

## Abort phases and already-aborted calls

A `RUNTIME.ABORTED` error raised during the middleware stage before encoding has `details.phase` `'beforeEncode'`. Code that matches `'beforeQuery'` or `'beforeExecute'` matches `'beforeEncode'` instead. A call whose signal was aborted before it was made now fires `activityStarted`, then ends `failed`, before it rejects with `RUNTIME.ABORTED`.

## The observed-row budget now runs

`budgets()` now counts the rows each query returns. Before, this check never ran, so a query that returned more than `maxRows` rows succeeded. Now, with the default row severity `'error'` or in `strict` mode, such a query fails with `BUDGET.ROWS_EXCEEDED` once the count passes `maxRows`; with `severities: { rowCount: 'warn' }` in `permissive` mode it logs one warning for the statement and keeps streaming. Raise `maxRows` or `tableRows`, or set the row severity to `'warn'`, for reads that are expected to return more rows.

## Run statements through the statement runners

A family runtime no longer composes the middleware runners itself. It runs each statement through one call that starts the activity, runs a body, and ends and finalizes the activity:

```diff
- await runBeforeQueryChain(exec, this.middleware, ctx, mutator);
- yield* reportQueryEnding(onQueryEnd, () =>
-   runQueryWithMiddleware(exec, this.middleware, ctx, () => this.runDriver(exec)),
- );
+ yield* streamStatement(
+   { middleware: this.middleware, plan, context: contextFields, parent: undefined },
+   async function* (run) {
+     const exec = await prepare(run); // calls run.beforeEncode(draft, mutator) before encoding
+     yield* run.runQuery(exec, () => self.runDriver(exec));
+   },
+ );
```

`executeStatement` is the same for `execute()`, with `run.runExecute(exec, runDriver)`. `context` is an `ActivityContextFields`: the runtime-wide fields (`contract`, `mode`, `now`, `log`, `contentHash`, `scope`, and `signal` when the caller passed one); the runner adds `parent`, `state` and `inTransaction`. `parent` is the open transaction a statement was sent on, or `undefined`. `RuntimeCoreOptions.ctx` takes the same fields, so remove `planExecutionId` from it.

A runtime that opens transactions calls `startTransactionActivity({ middleware, context })` before `BEGIN`, passes the result as the `parent` of every statement sent on the transaction or its connection while it is open, and calls `end({ by: 'commit' | 'rollback', outcome, ... })` when `commit()` or `rollback()` settles. A SQL runtime subclass that wrapped a driver transaction with `wrapTransaction(driverTx, connection)` calls `beginTransactionOn(connection)` instead, which does all of this.

## Renamed log events

A test or log filter that matches the runtime's debug event `middleware.interceptQuery` or `middleware.interceptExecute` matches `middleware.intercept.onQuery` or `middleware.intercept.onExecute`. The error event `middleware.afterTransaction.error` is now `middleware.activityFinalized.error`.
