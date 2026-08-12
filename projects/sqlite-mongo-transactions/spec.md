# Summary

Add first-class user-facing transaction support for SQLite and MongoDB facades.

SQLite already has lower-level transaction support through the SQL runtime and SQLite driver, but the `sqlite(...)` facade does not expose the same `db.transaction(...)` convenience that Postgres exposes. MongoDB has no transaction surface yet; it needs session-backed runtime/driver support and a facade-level `db.transaction(...)` API.

The project delivers the smallest useful surface first:

1. **SQLite facade parity** — add `db.transaction(fn)` to `SqliteClient<TContract>` by reusing the existing SQL `withTransaction(runtime, fn)` helper.
2. **MongoDB session transactions** — add a Mongo transaction scope backed by `ClientSession`, route runtime execution through that scope, then expose `db.transaction(fn)` on the Mongo facade.

# Description

## Problem

Transaction support is uneven across target facades:

- Postgres exposes both a low-level SQL runtime helper and a high-level facade API: `db.transaction(async (tx) => { ... })`.
- SQLite has SQL runtime and driver transaction support, but no high-level `db.transaction(...)` method on the facade.
- MongoDB has no transaction support. The Mongo e2e fixture already uses `MongoMemoryReplSet` and carries a note that a future `withTransaction()` test should run there, but the runtime and driver currently execute commands without sessions.

This creates a user-facing inconsistency: applications can express multi-operation atomic work ergonomically for Postgres, but not for SQLite or MongoDB.

## Current state

### SQLite

SQLite transaction mechanics already exist:

- `packages/3-targets/7-drivers/sqlite/src/sqlite-driver.ts`
  - `SqliteConnectionImpl.beginTransaction()` executes `BEGIN`.
  - `SqliteTransactionImpl.commit()` executes `COMMIT`.
  - `SqliteTransactionImpl.rollback()` executes `ROLLBACK`.
- `packages/2-sql/5-runtime/src/sql-runtime.ts`
  - `Runtime.connection()` exposes `RuntimeConnection.transaction()`.
  - `withTransaction(runtime, fn)` handles callback execution, commit, rollback, invalidation, and connection cleanup.

The missing piece is only the extension facade:

- `packages/3-extensions/sqlite/src/runtime/sqlite.ts`
  - `SqliteClient<TContract>` exposes `sql`, `orm`, `raw`, `context`, `stack`, `connect()`, `runtime()`, `prepare()`, `close()`, and `[Symbol.asyncDispose]()`.
  - It does not expose `transaction()`.

### MongoDB

Mongo transaction mechanics are absent:

- `packages/2-mongo-family/6-transport/mongo-lowering/src/driver-types.ts`
  - `MongoDriver.execute(wireCommand)` accepts only a wire command, with no session/scope parameter.
- `packages/3-mongo-target/3-mongo-driver/src/mongo-driver.ts`
  - `MongoDriverImpl.execute(...)` directly calls collection methods without `{ session }`.
- `packages/2-mongo-family/7-runtime/src/mongo-runtime.ts`
  - `MongoRuntime` exposes only `execute(...)` and `close()`.
  - A comment notes that future connection/transaction surfaces should mirror SQL scope handling.
- `packages/3-extensions/mongo/src/runtime/mongo.ts`
  - `MongoClient<TContract>` exposes `orm`, `query`, `contract`, `connect()`, `runtime()`, `close()`, and `[Symbol.asyncDispose]()`.
  - It does not expose `transaction()`.

Mongo migrations/control remain a separate concern. The Mongo control target already documents that DDL operations such as `createCollection`, `createIndex`, `collMod`, and validation changes are not wrapped transactionally; this project does not change that migration guarantee.

# Requirements

## Functional Requirements

### FR1 — SQLite facade transaction API

- Add `transaction<R>(fn: (tx: SqliteTransactionContext<TContract>) => PromiseLike<R>): Promise<R>` to `SqliteClient<TContract>`.
- `SqliteTransactionContext<TContract>` must mirror the Postgres transaction context shape where possible:
  - extends the SQL runtime `TransactionContext` so low-level `tx.execute(...)` and `tx.executePrepared(...)` remain available;
  - exposes `tx.sql` with the same type as `db.sql`;
  - exposes `tx.orm` with the same type as `db.orm`.
- The transaction callback return type must be preserved exactly in the returned `Promise<R>`.
- The transaction context must not expose nested `transaction()`.
- The implementation must use existing SQL runtime transaction machinery instead of duplicating commit/rollback cleanup logic.

### FR2 — SQLite transaction behavior

- On callback success, the transaction commits.
- On callback error, the transaction rolls back and rethrows the callback error unless rollback itself fails according to existing SQL runtime behavior.
- Queries through `tx.sql`, `tx.orm`, `tx.execute(...)`, and `tx.executePrepared(...)` run on the transaction scope.
- Returned `AsyncIterableResult` values are collected before commit when awaited by the helper, matching SQL runtime behavior.
- Escaped transaction-scoped results reject after the transaction has ended, matching the existing `withTransaction(...)` invalidation guard.
- Calling `db.transaction(...)` after `db.close()` rejects with `Error('SQLite client is closed')` through the existing runtime access guard.

### FR3 — Mongo driver transaction scope

- Add a session-capable Mongo execution scope below or inside `MongoDriver`.
- Commands executed inside a transaction must pass the same `ClientSession` to every supported MongoDB operation:
  - `insertOne`
  - `insertMany`
  - `updateOne`
  - `updateMany`
  - `deleteOne`
  - `deleteMany`
  - `findOneAndUpdate`
  - `findOneAndDelete`
  - `aggregate`
- Transaction sessions must be ended after commit/abort.
- The driver must support transaction scopes for both facade-owned clients (`url` / `uri` + `dbName`) and caller-supplied `MongoClient` bindings.
- If implementation reveals that `MongoDriverImpl.fromDb(db)` cannot reliably access the underlying `MongoClient`, add a factory/binding path that receives the `MongoClient` explicitly rather than weakening transaction support.

### FR4 — Mongo runtime transaction API

- Add a Mongo runtime transaction helper/surface that hides session plumbing from users.
- The transaction runtime scope must expose `execute(plan, options?)` with the same row typing as normal runtime execution.
- Middleware context scope must be `transaction` for executions routed through a transaction.
- Each transaction-scoped execution must still mint a fresh `planExecutionId`.
- Abort signals must continue to flow through lower/encode/decode/stream boundaries as they do for normal Mongo runtime execution.
- Transaction-scoped results must not be safely consumable after the transaction has ended; mirror the SQL invalidation behavior.

### FR5 — Mongo facade transaction API

- Add `transaction<R>(fn: (tx: MongoTransactionContext<TContract>) => PromiseLike<R>): Promise<R>` to `MongoClient<TContract>`.
- `MongoTransactionContext<TContract>` must expose:
  - `tx.orm`, equivalent in type to `db.orm`, but executing through the transaction scope;
  - `tx.query`, equivalent in type to `db.query`, for building Mongo query plans;
  - a low-level transaction-scoped `execute(...)` method for query plans.
- The transaction callback return type must be preserved exactly in the returned `Promise<R>`.
- The transaction context must not expose nested `transaction()`.
- `db.transaction(...)` must lazily create the runtime just like `db.orm` terminals and `db.runtime()` do today.

### FR6 — Mongo transaction behavior

- On callback success, all transaction-scoped writes commit atomically.
- On callback error, all transaction-scoped writes abort and the callback error is rethrown unless abort/cleanup fails with a more specific transaction failure envelope.
- Reads inside the transaction observe writes made earlier in the same transaction.
- Reads outside the transaction do not observe uncommitted transaction writes.
- Transaction support requires a MongoDB replica set. The implementation must not silently degrade to non-transactional execution on standalone MongoDB.
- Transaction errors from unsupported topology or server configuration must surface clearly enough for users to identify the replica-set requirement.

## Non-Functional Requirements

- Keep the public user-facing shape consistent: `db.transaction(async (tx) => { ... })` for Postgres, SQLite, and MongoDB.
- Avoid a broad cross-family transaction abstraction in the first implementation. SQL and Mongo may share surface concepts, but their runtime internals should remain family-specific until a common abstraction has proven value.
- Preserve existing SQL runtime semantics for Postgres and SQLite.
- Preserve existing Mongo non-transaction execution behavior for callers that do not call `db.transaction(...)`.
- Follow repo constraints:
  - write or update tests before implementation;
  - no `any`;
  - no bare production `as` casts;
  - no lint suppressions;
  - no TypeScript import extensions;
  - no backwards-compat aliases unless explicitly requested.

## Non-goals

- Adding or changing Postgres transaction behavior.
- Adding a cross-family framework-level `TransactionalRuntime` abstraction in this project.
- Mongo migration/control DDL transactions. Mongo DDL remains resumable/verify-gated, not transactionally rolled back across spaces.
- Nested transactions, savepoints, or retryable transaction policy configuration in the first slice.
- Exposing Mongo transaction options such as custom read concern, write concern, read preference, or max commit time in the first slice.
- Change streams or other session-adjacent Mongo features.
- Example/demo updates before explicit approval, per repo rules.

# Acceptance Criteria

## SQLite facade parity

- [ ] `SqliteClient<TContract>` exposes `transaction<R>(...)`.
- [ ] `SqliteTransactionContext<TContract>` exposes `sql`, `orm`, `execute`, and `executePrepared`.
- [ ] `tx.sql` has the same type as `db.sql`.
- [ ] `tx.orm` has the same type as `db.orm`.
- [ ] `tx.transaction` is absent at the type level and at runtime.
- [ ] `db.transaction(async () => value)` returns `Promise<typeof value>`.
- [ ] Successful SQLite facade transactions commit.
- [ ] Failing SQLite facade transactions roll back.
- [ ] ORM write/read inside a SQLite facade transaction uses the transaction scope.
- [ ] Escaped SQLite transaction results reject after transaction end.
- [ ] `db.transaction(...)` after `db.close()` rejects with `Error('SQLite client is closed')`.

## Mongo runtime and driver

- [ ] `MongoDriver` or a closely scoped companion interface can execute commands inside a `ClientSession` transaction.
- [ ] Every supported Mongo wire command receives `{ session }` when executed in a transaction.
- [ ] Sessions are ended on success and failure.
- [ ] Runtime middleware sees `ctx.scope === 'transaction'` inside Mongo transactions.
- [ ] Runtime middleware sees a fresh `planExecutionId` for each transaction-scoped execution.
- [ ] Mongo transaction-scoped execution preserves existing abort-signal behavior.
- [ ] Escaped Mongo transaction results reject after transaction end.

## Mongo facade

- [ ] `MongoClient<TContract>` exposes `transaction<R>(...)`.
- [ ] `MongoTransactionContext<TContract>` exposes `orm`, `query`, and transaction-scoped `execute(...)`.
- [ ] `tx.orm` has the same type as `db.orm`.
- [ ] `tx.query` has the same type as `db.query`.
- [ ] `tx.transaction` is absent at the type level and at runtime.
- [ ] `db.transaction(async () => value)` returns `Promise<typeof value>`.
- [ ] `db.transaction(...)` lazily creates the runtime when needed.
- [ ] `db.transaction(...)` after `db.close()` rejects with `Error('Mongo client is closed')`.

## Mongo behavior

- [ ] A Mongo transaction that writes multiple documents commits all writes on success.
- [ ] A Mongo transaction that throws after one or more writes rolls back all writes.
- [ ] A read inside the Mongo transaction observes a prior write from the same transaction.
- [ ] A read outside the Mongo transaction cannot observe uncommitted writes.
- [ ] The transaction e2e tests run against `MongoMemoryReplSet`, not standalone `MongoMemoryServer`.
- [ ] Running against unsupported standalone topology does not silently run non-transactionally.

# Adapter impact

- `packages/3-extensions/sqlite/**` — add facade transaction context type, client method, type tests, unit/facade tests, and possibly e2e coverage.
- `packages/2-mongo-family/6-transport/mongo-lowering/**` — extend Mongo driver/queryable types for transaction/session-capable execution.
- `packages/3-mongo-target/3-mongo-driver/**` — implement session-backed command execution and transaction lifecycle.
- `packages/2-mongo-family/7-runtime/**` — add transaction-scoped runtime execution and middleware context scope handling.
- `packages/3-extensions/mongo/**` — add facade transaction context type, client method, and e2e/type tests.
- `packages/3-extensions/middleware-cache/**` — no expected implementation change, but Mongo transaction tests should confirm transaction scope bypasses runtime-only cache behavior the same way SQL does.

# References

- SQLite facade: `packages/3-extensions/sqlite/src/runtime/sqlite.ts`
- Postgres facade transaction precedent: `packages/3-extensions/postgres/src/runtime/postgres.ts`
- SQL runtime transaction helper: `packages/2-sql/5-runtime/src/sql-runtime.ts`
- SQL driver transaction interfaces: `packages/2-sql/4-lanes/relational-core/src/ast/driver-types.ts`
- SQLite driver transaction implementation: `packages/3-targets/7-drivers/sqlite/src/sqlite-driver.ts`
- Mongo runtime: `packages/2-mongo-family/7-runtime/src/mongo-runtime.ts`
- Mongo driver interface: `packages/2-mongo-family/6-transport/mongo-lowering/src/driver-types.ts`
- Mongo driver implementation: `packages/3-mongo-target/3-mongo-driver/src/mongo-driver.ts`
- Mongo facade: `packages/3-extensions/mongo/src/runtime/mongo.ts`
- Mongo replica-set e2e fixture note: `packages/3-extensions/mongo/test/mongo.e2e.test.ts`
- Mongo DDL transaction non-goal precedent: `packages/3-mongo-target/1-mongo-target/src/core/control-target.ts`

# Open Questions

1. **Mongo low-level shape:** Should the Mongo driver expose `beginTransaction()` plus `commit/rollback`, or a callback-based `withTransaction(...)` helper around `ClientSession.withTransaction(...)`?
   - Default assumption: use an explicit transaction scope internally so runtime/facade code can mirror SQL invalidation and callback handling, while still allowing Mongo-specific retry behavior later.

2. **Mongo transaction options:** Should users be able to pass read/write concern options in the initial public API?
   - Default assumption: no. Land the default transaction behavior first; add options once the core surface is stable.

3. **Mongo result invalidation:** Should Mongo reuse a family-neutral helper for guarding escaped `AsyncIterableResult` values?
   - Default assumption: implement Mongo-local parity with SQL first; extract only if duplication becomes meaningful.

4. **Standalone topology diagnostic:** Do we need a custom error envelope for transactions attempted on standalone MongoDB?
   - Default assumption: do not pre-normalize all Mongo topology errors in the first slice, but add one test or assertion that the failure is not silent and mentions transaction/session topology clearly enough.
