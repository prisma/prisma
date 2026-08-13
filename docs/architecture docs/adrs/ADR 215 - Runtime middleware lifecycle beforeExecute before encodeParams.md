# ADR 215 — Runtime middleware lifecycle: operation-specific query and execute hooks

## Status

Accepted ([TML-2375](https://linear.app/prisma-company/issue/TML-2375)). Amended August 12, 2026 to record the shipped operation-specific lifecycle. The original decision moved `beforeExecute` before parameter encoding; this amendment preserves that ordering and documents the corresponding query lifecycle.

## At a glance

Runtime operations answer two different questions. `query()` streams rows, while `execute()` runs a non-row statement and returns statement statistics. The middleware contract mirrors that distinction in its hook names and result shapes:

```text
SQL beforeCompile (shared for both operations)
  ├─ query:   beforeQuery → encodeParams → interceptQuery → driver query → onRow → afterQuery
  └─ execute: beforeExecute → encodeParams → interceptExecute → driver execute → afterExecute
```

The `encodeParams` step is shown between the before and intercept hooks because parameter-mutating middleware must see user-domain values before encoding, while interceptors see the fully encoded execution plan. The public lifecycle is operation-specific; there is no operation discriminator on the middleware context or completion result.

## Context

A family runtime first applies its shared compile lifecycle, lowers the plan, and then runs the selected operation. SQL lowers into a draft containing user-domain parameter values before codec encoding. `beforeQuery` and `beforeExecute` run at that seam and receive the optional family-specific parameter mutator. The runtime then encodes the mutated values and passes the final execution plan to the matching interceptor and driver terminal.

This ordering keeps parameter-mutating middleware structurally possible. For example, encryption middleware can populate a value's ciphertext before the codec encodes it. It also keeps interception truthful: a query interceptor supplies rows, and an execute interceptor supplies statistics. No runtime path derives a count from a row array.

The earlier implementation used one generic lifecycle and one `intercept` hook. That shape made a row result and a statistics result share a vocabulary, encouraged operation inference, and could make parameter-mutating middleware run after encoding. The operation-specific contract is a compatibility-free hard cut: middleware authors select the operation they implement.

## Decision

### Shared compilation and operation selection

SQL runs `beforeCompile` once for the plan before choosing the operation. This hook rewrites the SQL AST and is shared by row and statistics operations. It is not a query or execute hook and does not carry an operation discriminator.

After compilation, the runtime chooses one of these explicit paths:

- `query(plan, options?)` returns `AsyncIterableResult<Row>`. It runs `beforeQuery`, encodes parameters, runs `interceptQuery`, and either consumes the intercepted rows or calls `SqlQueryable.query()`. Driver rows pass through `onRow` and are then decoded for the consumer. `afterQuery` receives row count, completion, latency, and source.
- `execute(plan, options?)` returns `Promise<RuntimeStatementStats>`. It runs `beforeExecute`, encodes parameters, runs `interceptExecute`, and either returns intercepted statistics or calls `SqlQueryable.execute()`. `afterExecute` receives the statistics on success, or a completion failure without statistics.

The SQL runtime uses one preparation structure for both paths: lower to a pre-encode draft, run the selected before chain, encode the draft, and invoke the selected terminal. Prepared row queries use the same query lifecycle with a request handle; the handle does not create a separate middleware operation.

### Query lifecycle

The query lifecycle is, in order:

1. `beforeCompile` runs once for SQL and may return a rewritten AST.
2. `beforeQuery` runs in middleware registration order on the lowered draft. It may use the SQL parameter mutator; errors abort before interception and do not invoke `afterQuery`.
3. The runtime encodes the possibly mutated parameter values.
4. `interceptQuery` runs in registration order on the encoded execution plan. The first non-`undefined` `{ rows }` result wins. A hit skips the driver and `onRow`; the intercepted rows still flow to the consumer and `afterQuery` reports `source: 'middleware'`.
5. On a miss, `SqlQueryable.query(request)` supplies the row stream. `onRow` runs for each driver row before the row is yielded to the consumer.
6. `afterQuery` runs once with `{ rowCount, latencyMs, completed, source }`. Completion errors are swallowed on the error path so they do not mask the original query, interception, or driver error.

`QueryInterceptResult` is deliberately row-shaped:

```ts
interface QueryInterceptResult {
  readonly rows: AsyncIterable<Record<string, unknown>> | Iterable<Record<string, unknown>>;
}
```

### Execute lifecycle

The execute lifecycle is, in order:

1. `beforeCompile` runs once for SQL and may return a rewritten AST.
2. `beforeExecute` runs in middleware registration order on the lowered draft. It may use the SQL parameter mutator; errors abort before interception and do not invoke `afterExecute`.
3. The runtime encodes the possibly mutated parameter values.
4. `interceptExecute` runs in registration order on the encoded execution plan. The first non-`undefined` `{ stats }` result wins. A hit skips the driver and returns the supplied statistics eagerly.
5. On a miss, `SqlQueryable.execute(request)` returns the driver's actual statement statistics. There is no row stream and `onRow` does not run.
6. `afterExecute` runs once with `{ stats, latencyMs, completed: true, source }` on success, or `{ latencyMs, completed: false, source }` on failure. Completion errors are swallowed on the error path so they do not mask the original execute, interception, or driver error.

`ExecuteInterceptResult` is deliberately statistics-shaped:

```ts
interface ExecuteInterceptResult {
  readonly stats: RuntimeStatementStats;
}
```

The first non-`undefined` interceptor wins independently on each operation. A query interceptor cannot satisfy an execute operation, and an execute interceptor cannot supply query rows. This is enforced by the hook names and types rather than a runtime `operation` field.

### Context and result shape

`RuntimeMiddlewareContext` is shared by all hooks selected for one operation and carries the contract, cancellation signal, scope, content-hash function, and `planExecutionId`. It does not carry an operation discriminator. Hook selection is the discriminator.

The completion types are likewise operation-specific:

- `AfterQueryResult` has `rowCount`, `latencyMs`, `completed`, and `source`.
- `AfterExecuteResult` has `latencyMs`, `completed`, and `source`, plus `stats` only when `completed` is `true`.

This prevents statistics middleware from accidentally treating a row count as an affected-row count. `affectedRows` comes from `SqlQueryable.execute()` or an explicit execute interception result.

## Scope composition

Every SQL runtime scope exposes both semantic operations through the same `RuntimeScope` contract:

```ts
interface RuntimeScope {
  query<Row>(plan: SqlOrmPlan<Row>, options?: RuntimeExecuteOptions): AsyncIterableResult<Row>;
  execute(plan: SqlOrmPlan, options?: RuntimeExecuteOptions): Promise<SqlStatementStats>;
}
```

The top-level runtime, checked-out connection, transaction, guarded transaction context, and Supabase role-bound scopes route each operation to their bound `SqlQueryable`. A query result remains lazy and must be consumed while its connection or transaction is valid. Statistics execution is eager and resolves to `{ affectedRows }`.

## Consequences

- Parameter-mutating middleware sees user-domain values before codec encoding on both operation paths.
- Interceptors see the final encoded plan, so cache keys and other observations match the request sent to the driver.
- Query middleware can observe rows through `onRow`; execute middleware cannot accidentally receive a row stream.
- A statistics result cannot be fabricated from query rows. An interceptor must return `{ stats }`, and a driver must return actual statement statistics.
- Middleware that applies to both operations implements the corresponding hooks twice or delegates both names to one private function. There are no generic fallback aliases.
- A before-hook failure occurs outside the managed terminal lifecycle and therefore does not invoke the matching after-hook. Failures during interception, driver execution, or row consumption do invoke the matching after-hook with `completed: false`.

## Related

- [ADR 204 — Single-tier runtime](./ADR%20204%20-%20Single-tier%20runtime.md) — the family runtime composition this ADR refines.
- [ADR 207 — Codec call context per-query AbortSignal and column metadata](./ADR%20207%20-%20Codec%20call%20context%20per-query%20AbortSignal%20and%20column%20metadata.md) — the per-operation signal threaded through middleware and codecs.
- [ADR 210 — Prepared Statements](./ADR%20210%20-%20Prepared%20Statements%20-%20Author%20Surface%20and%20Driver%20SPI.md) — prepared row requests use the optional opaque handle on the SQL request.
- [ADR 220 — Plan execution identity for middleware correlation](./ADR%20220%20-%20Plan%20execution%20identity%20for%20middleware%20correlation.md) — the `planExecutionId` carried by the shared context.
- [ADR 239 — Errors are structural envelopes with dotted namespace codes](./ADR%20239%20-%20Errors%20are%20structural%20envelopes%20with%20dotted%20namespace%20codes.md) — the current structured error vocabulary.
- [`@internal/framework-components/runtime`](../../../packages/1-framework/1-core/framework-components/src/execution/) — operation-specific middleware runners.
