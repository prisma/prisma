# ADR 187 — Transaction-scoped streams use invalidation, not buffering

## At a glance

When a user calls `db.transaction(callback)`, the callback receives a transaction context with `tx.execute(plan)` that returns `AsyncIterableResult<Row>` — the same lazy streaming type used outside transactions. Rather than eagerly buffering results inside transactions or constraining the return type, the transaction scope is **invalidated** on commit/rollback. Any attempt to consume an `AsyncIterableResult` after the transaction ends produces a clear, actionable error.

## Context

The callback-based transaction API provides `tx.orm`, `tx.sql`, and `tx.execute(plan)` bound to a single database connection. After the callback completes, the transaction commits (or rolls back on error) and the connection is released.

`AsyncIterableResult<Row>` is lazy — rows are pulled on demand via `for await` or `.toArray()`. It also implements `PromiseLike<Row[]>`, so `await result` eagerly drains it. The concern: if a user returns an unconsumed `AsyncIterableResult` from the callback (especially wrapped in an object), it escapes the transaction scope. The connection is already released, so subsequent iteration would fail or read from a recycled connection.

## Decision

**Invalidate the transaction scope on commit/rollback.** The transaction-scoped `RuntimeQueryable` sets an `invalidated` flag after commit/rollback. Any `AsyncIterableResult` created by `tx.execute()` that is consumed after the transaction ends produces an error:

*"Cannot read from a query result after the transaction has ended. Await the result or call .toArray() inside the transaction callback."*

## Alternatives considered

### Eager buffering inside transactions

`tx.execute` would internally drain all rows to an array, then wrap them in a pre-materialized `AsyncIterableResult`. Same return type, no leak possible.

**Rejected because:** it silently changes `execute()` semantics inside transactions (always eager) vs outside (lazy/streaming). This is surprising, increases memory pressure, and creates a behavioral difference that is invisible at the type level. Streaming inside transactions is not inherently wrong — the user may want to process a large result set row-by-row within the transaction without materializing all rows in memory.

### Type-level prevention

Constrain the callback's return type to exclude `AsyncIterableResult`:

```typescript
type NoAsyncIterable<T> = T extends AsyncIterable<unknown> ? never : T;
transaction<R>(fn: (tx: TxCtx) => PromiseLike<NoAsyncIterable<R>>): Promise<R>;
```

**Rejected because:** conditional types on generic return types interact poorly with inference — `R` may resolve to `never` instead of producing a useful error. Cannot catch `AsyncIterableResult` nested inside returned objects. Adds type complexity without runtime safety.

### Runtime error before commit (tracking approach)

Track every `AsyncIterableResult` created by the transaction. Before commit, check if any are unconsumed and throw.

**Rejected because:** it is an error to have an unconsumed stream only if the user tries to read from it after the transaction — an unconsumed stream that is simply discarded is harmless. Throwing before commit would reject valid patterns where the user intentionally ignores a result.

### Do nothing (document the pitfall)

The direct return case (`return tx.execute(plan)`) is already safe because `PromiseLike` causes auto-drain. Only the "wrap in object" case is hazardous.

**Rejected because:** `return { users: tx.execute(plan1), posts: tx.execute(plan2) }` is a natural and common pattern. Relying on documentation for a failure mode that produces confusing errors (connection gone, recycled connection) is insufficient.

## Why this is safe: wire protocol analysis

A separate concern was whether unconsumed result streams could hide database errors (e.g., constraint violations) within a transaction, allowing a COMMIT that should have been a ROLLBACK. Investigation confirmed this is not an issue:

- **Not a wire protocol issue.** The Postgres wire protocol is push-oriented — the server sends `ErrorResponse` immediately. The delayed error surfacing observed in the Rust tokio-postgres driver was an architectural issue specific to that library's futures/polling model, not a protocol limitation.
- **node-postgres reads eagerly.** The `pg` library attaches `stream.on('data', ...)` to the socket. The event loop drains all server responses regardless of whether user code has consumed the result.
- **DML executes fully.** INSERT/UPDATE/DELETE (with or without RETURNING) executes atomically — cursors (DECLARE CURSOR) are SELECT/VALUES-only. Mutation errors are always surfaced.
- **Failed transaction state is server-side.** If any statement errors, the server marks the transaction as aborted. A subsequent COMMIT returns the command tag ROLLBACK regardless of whether the client read the original error.
- **Cursors defer execution, not errors.** With cursors, unfetched SELECT rows are genuinely never evaluated by the server — this is not error suppression but incomplete execution. For pure reads, this is harmless. For SELECT FOR UPDATE, locks are acquired per-FETCH, but this is only meaningful if the user reads the results to act on them within the same transaction — partial consumption of a FOR UPDATE query is already an application logic bug independent of the streaming API.

## Consequences

- `execute()` has consistent lazy semantics everywhere — no hidden behavioral difference inside transactions.
- Users who accidentally leak an `AsyncIterableResult` get a clear error at the point of misuse (when they try to read from it), not a confusing connection error.
- No type-level complexity or inference issues on the `transaction` method signature.
- The `PromiseLike` implementation on `AsyncIterableResult` means `await db.transaction((tx) => tx.execute(plan))` drains eagerly and works correctly — the most common pattern is safe by default.
