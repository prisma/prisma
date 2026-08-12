# Project Plan

## Summary

Deliver user-facing transactions for SQLite and MongoDB in two milestones:

1. **SQLite facade parity** — a small, low-risk slice that adds `db.transaction(...)` to `sqlite(...)` by reusing the existing SQL runtime transaction helper.
2. **MongoDB session transactions** — a larger slice that adds session-backed transaction execution to the Mongo driver/runtime and exposes it as `db.transaction(...)` on the Mongo facade.

The public API should feel consistent across Postgres, SQLite, and MongoDB, but the implementation should remain family-specific. Do not introduce a cross-family transaction abstraction in this project unless implementation pressure proves it necessary.

**Spec:** [`./spec.md`](./spec.md)

## Milestones

### Milestone 1 — SQLite facade parity

**Purpose.** Make SQLite match the existing Postgres facade transaction API with minimal architectural work.

**Scope.**

- `packages/3-extensions/sqlite/src/runtime/sqlite.ts`
  - Import `TransactionContext` and `withTransaction` from `@internal/sql-runtime`.
  - Add `SqliteTransactionContext<TContract>` extending `TransactionContext`.
  - Add `transaction<R>(...)` to `SqliteClient<TContract>`.
  - Implement `transaction(...)` by calling `withTransaction(getRuntime(), ...)`.
  - Build transaction-scoped `tx.sql` with the existing `sqlBuilder` and context.
  - Build transaction-scoped `tx.orm` with an executor that routes through `txCtx.execute(plan)`.
  - Use the `Object.create(txCtx)` pattern from Postgres so live getters such as `invalidated` stay wired.

**Tests first.**

- Add SQLite facade type tests:
  - `db.transaction(...)` preserves callback return type.
  - `tx.sql` equals `db.sql` type.
  - `tx.orm` equals `db.orm` type.
  - `tx.transaction` is absent.
- Add SQLite facade runtime tests:
  - `transaction()` delegates to SQL `withTransaction` behavior through the lazy runtime.
  - `transaction()` lazily creates the runtime before explicit `connect()` if binding exists.
  - `transaction()` rejects after `db.close()`.
- Add or extend SQLite e2e tests:
  - commit on success;
  - rollback on error;
  - ORM write then read inside the same transaction;
  - escaped transaction result rejects after transaction end.

**Likely validation.**

- `pnpm --filter @internal/sqlite test`
- relevant SQLite e2e/integration command used by the repo for `test/e2e/framework/test/sqlite/**`
- package typecheck if tests do not include type tests automatically

**Done when.** All SQLite acceptance criteria in [`./spec.md`](./spec.md) pass.

### Milestone 2 — Mongo transaction design spike and failing tests

**Purpose.** Lock the Mongo implementation shape before touching driver/runtime internals. The goal is to avoid smuggling SQL connection assumptions into Mongo's session model.

**Scope.**

- Decide the low-level Mongo transaction primitive:
  - `beginTransaction()` returning an explicit transaction/queryable scope; or
  - callback-based `withTransaction(...)` around `ClientSession.withTransaction(...)`.
- Decide how `MongoDriverImpl` gets a `MongoClient` for session creation for both URL-owned and caller-supplied client bindings.
- Decide the transaction-scope interface names and export location.
- Decide whether transaction options are deferred completely or represented by an internal-only options bag.
- Add failing type/unit tests for the selected interface before implementation.

**Tests first.**

- Driver/interface tests proving a transaction-capable scope can execute every supported wire command with a session.
- Runtime type tests proving the transaction scope preserves `execute<Row>(...)` row typing.
- Facade type tests proving `MongoClient.transaction(...)`, `tx.orm`, `tx.query`, and absence of nested `tx.transaction`.

**Done when.** The Mongo transaction API shape is explicit in tests and the plan has enough detail to implement without revisiting the core design.

### Milestone 3 — Mongo driver/session support

**Purpose.** Implement the session-aware command execution layer that runtime transactions can depend on.

**Scope.**

- `packages/2-mongo-family/6-transport/mongo-lowering/src/driver-types.ts`
  - Extend or supplement `MongoDriver` with transaction/session-capable execution types.
- `packages/3-mongo-target/3-mongo-driver/src/mongo-driver.ts`
  - Store or derive the `MongoClient` needed for `startSession()`.
  - Create a transaction scope backed by `ClientSession`.
  - Pass `{ session }` into every supported collection operation when scoped.
  - End sessions on commit/abort/final cleanup.
  - Preserve normal non-transaction execution behavior.

**Tests first.**

- Unit tests with mocked/stubbed collection/session behavior confirming `{ session }` is forwarded for:
  - insert one/many;
  - update one/many;
  - delete one/many;
  - find-and-modify variants;
  - aggregate.
- Lifecycle tests:
  - session ends on commit;
  - session ends on abort;
  - session ends when callback throws;
  - normal execution does not allocate a session.

**Done when.** Mongo driver transaction scope is independently tested and normal driver tests still pass.

### Milestone 4 — Mongo runtime transaction support

**Purpose.** Route Mongo query plans through transaction-scoped driver execution while preserving runtime behavior: middleware, abort signals, decoding, result invalidation, and row typing.

**Scope.**

- `packages/2-mongo-family/7-runtime/src/mongo-runtime.ts`
  - Add a transaction helper or method to the runtime surface.
  - Add transaction-scoped execution that mirrors normal `execute(...)` but invokes the transaction queryable/scope.
  - Set middleware `ctx.scope` to `transaction` for transaction-scoped execution.
  - Preserve fresh `planExecutionId` per execution.
  - Preserve abort-signal threading.
  - Guard escaped `AsyncIterableResult` consumption after transaction end.

**Tests first.**

- Runtime unit tests:
  - transaction commit on callback success;
  - abort/rollback on callback error;
  - middleware sees `scope: 'transaction'`;
  - middleware sees unique `planExecutionId` per execution;
  - abort signals flow through transaction-scoped execution;
  - escaped result rejects after transaction end.
- Cache middleware compatibility test if needed, proving transaction-scoped Mongo operations bypass runtime-only cache interception.

**Done when.** Mongo runtime can execute transaction-scoped plans without facade involvement.

### Milestone 5 — Mongo facade transaction API and e2e coverage

**Purpose.** Expose the user-facing `db.transaction(...)` API on `mongo(...)` and prove it works through the ORM/runtime/driver stack against a replica set.

**Scope.**

- `packages/3-extensions/mongo/src/runtime/mongo.ts`
  - Add `MongoTransactionContext<TContract>`.
  - Add `transaction<R>(...)` to `MongoClient<TContract>`.
  - Lazily create/reuse the runtime via the existing `getRuntime()` path.
  - Build transaction-scoped `tx.orm` with an executor routed through the transaction scope.
  - Expose `tx.query` for plan construction.
  - Expose low-level transaction-scoped `tx.execute(...)`.

**Tests first.**

- Facade type tests:
  - return type inference;
  - `tx.orm` type equals `db.orm`;
  - `tx.query` type equals `db.query`;
  - no nested `tx.transaction`.
- Facade unit tests:
  - `transaction()` lazily creates runtime;
  - `transaction()` rejects after `db.close()`;
  - `transaction()` routes ORM terminals through transaction-scoped execution.
- E2E tests using `MongoMemoryReplSet`:
  - multiple writes commit together;
  - writes roll back on throw;
  - read-your-own-write inside transaction;
  - outside read does not observe uncommitted transaction writes;
  - escaped result rejects after transaction end.

**Done when.** All Mongo facade/runtime behavior acceptance criteria in [`./spec.md`](./spec.md) pass.

### Milestone 6 — Documentation and close-out

**Purpose.** Document the user-facing transaction story and complete project lifecycle requirements.

**Scope.**

- Update target/facade READMEs if they already document runtime usage:
  - SQLite facade transaction example.
  - Mongo facade transaction example and replica-set requirement.
- Link to existing canonical Mongo notes rather than duplicating long migration-DDL caveats.
- Add release-note line if the repo has a current release-note mechanism.
- Revisit whether any durable architecture note is needed. Default: no ADR; this project adds facade/runtime parity and can be documented in package docs.

**Done when.** Docs reflect the implemented behavior and the project can be closed according to `projects/README.md`.

## Test Coverage Matrix

| Acceptance area | Test type | Milestone | Notes |
|---|---|---:|---|
| SQLite `db.transaction(...)` type surface | Type | 1 | Mirror `packages/3-extensions/postgres/test/transaction.types.test-d.ts` |
| SQLite commit/rollback | E2E / facade | 1 | Can reuse existing SQL runtime behavior through facade |
| SQLite ORM transaction scope | E2E | 1 | Proves `tx.orm` routes through `txCtx.execute` |
| SQLite escaped result invalidation | E2E | 1 | Mirrors existing SQL transaction e2e |
| Mongo transaction primitive shape | Type / unit | 2 | Failing tests define low-level seam before implementation |
| Mongo session forwarding | Unit | 3 | Every wire command passes `{ session }` in transaction scope |
| Mongo session lifecycle | Unit | 3 | Session ended on success/failure; normal execution unchanged |
| Mongo runtime transaction scope | Unit | 4 | Middleware scope, planExecutionId, abort, invalidation |
| Mongo facade type surface | Type | 5 | `tx.orm`, `tx.query`, return type, no nested transaction |
| Mongo commit/rollback behavior | E2E | 5 | Must use `MongoMemoryReplSet` |
| Mongo read-your-own-write | E2E | 5 | Transaction scope uses one session consistently |
| Mongo unsupported topology is not silent | Integration/unit | 5 | Exact error normalization can remain minimal first slice |
| Docs | Manual / doc review | 6 | Include replica-set requirement for Mongo |

## Risks and Mitigations

### Risk: Mongo's session model does not fit SQL's connection transaction helper

**Mitigation.** Keep Mongo internals family-specific. Reuse only the user-facing callback shape and the result invalidation pattern.

### Risk: Lazy `AsyncIterableResult` escapes a Mongo transaction callback

**Mitigation.** Mirror SQL `withTransaction(...)`: await callback results, invalidate the transaction context after callback completion, and guard iterators so post-transaction consumption rejects.

### Risk: Caller-supplied Mongo bindings lack access to `MongoClient.startSession()`

**Mitigation.** Verify whether `Db` exposes its owning `MongoClient`. If not, change the binding/factory path to pass the caller-supplied `MongoClient` into the driver explicitly.

### Risk: Standalone Mongo topology fails late or unclearly

**Mitigation.** Do not silently fallback. Add coverage that unsupported topology errors surface during transaction start/commit and document the replica-set requirement.

### Risk: Transaction support accidentally changes Mongo migration semantics

**Mitigation.** Keep runtime transactions separate from control/migration DDL paths. Do not route migration runners through the new facade transaction API.

## Suggested PR sequence

1. **PR 1: SQLite facade transaction parity**
   - Small, self-contained, low-risk.
   - Gives users immediate parity with Postgres for SQL targets.

2. **PR 2: Mongo transaction interfaces and driver session support**
   - Locks low-level seam and validates session forwarding/lifecycle.

3. **PR 3: Mongo runtime transaction scope**
   - Adds runtime helper/scope and middleware/invalidation semantics.

4. **PR 4: Mongo facade transaction API + e2e**
   - Adds user-facing surface and replica-set behavior tests.

5. **PR 5: Docs/close-out**
   - Can be folded into PR 4 if the docs are small.

## Close-out (required)

- [ ] Verify all acceptance criteria in [`./spec.md`](./spec.md).
- [ ] Migrate any long-lived docs into `docs/` or package READMEs.
- [ ] Strip repo-wide references to `projects/sqlite-mongo-transactions/**` or replace them with canonical docs links.
- [ ] Delete `projects/sqlite-mongo-transactions/` once the project is complete.
