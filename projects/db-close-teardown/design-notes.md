# Design notes: db-close-teardown

> Synthesized design document for `db-close-teardown`. Read this if you want to understand **what the project's design is**, **what principles it serves**, and **what alternatives were considered and rejected**. This document is not a chronological log of decisions — it captures the settled design, standing independently of the discussions that produced it.
>
> Owned by the Orchestrator. Authored directly. Updated as design settles; not as decisions happen. Cross-link from the project spec; never block on a design-notes update during execution.

## Principles this design serves

- **The facade owns the surface; the framework owns the engine.** `db.close()` belongs to the facade because the facade is the only layer that knows what it acquired on the caller's behalf. The framework runtime (`Runtime.close()`, `SqlRuntimeImpl.close()`, driver close paths) is unchanged.
- **Close what you opened; never close what was lent to you.** The facade tracks what it constructed (`pg.Pool` from `{ url }`, `MongoClient` from `{ url }` / `{ uri, dbName }`, SQLite handle from `{ path }`) and releases only those. Caller-supplied `pg.Pool` / `pg.Client` / `mongodb.MongoClient` / pre-built bindings flow through unmodified and are never disposed by the facade.
- **Symmetry between targets.** `postgres()`, `sqlite()`, and `mongo()` expose the same teardown surface so a developer fluent in one reads the others without surprise. Underlying lifecycle shapes (`connectPromise` + `driverConnected` vs `runtimePromise` + `closed`) are implementation details; the surface stays uniform.
- **Idempotent, terminal, AsyncDisposable-shaped.** `close()` after `close()` is a no-op. The closed state is terminal — no reconnect, no retry shape on a closed `db`. `[Symbol.asyncDispose]` aliases `close()` for `await using db = postgres({...})` on TS 5.2+.
- **No silent abort.** `close()` does not cancel in-flight queries. Callers `await` their work first; `close()` then releases transport. Cancellation is a separate concern.

## The model

### Where `close()` lives

The facade — the object returned by `postgres({...})`, `sqlite({...})`, `mongo({...})` — owns:

- The `pg.Pool` constructed in `toRuntimeBinding(...)` when the caller passed `{ url }` (Postgres).
- The SQLite handle the driver opened against the file `path` (SQLite).
- The `mongodb.MongoClient` built by `MongoDriverImpl.fromConnection(...)` when the caller passed `{ url }` or `{ uri, dbName }` (Mongo).
- The lazy `runtimeInstance` (Postgres / SQLite) or `runtimePromise` (Mongo) wired to those resources.

The facade does *not* own:

- Anything the caller supplied via the `pg` option (Postgres `pg.Pool` / `pg.Client`), the `mongoClient` option (Mongo), or a pre-built `binding`. These are caller-managed.
- `Runtime.close()` itself. The framework already exposes it; the facade does not change that, and does not call it (because that would unconditionally close the driver, violating the ownership rule for the caller-supplied case).

### Lifecycle state

A facade is in one of four states:

1. **Idle** — constructed but no runtime materialised, no driver connected.
2. **Connecting** — `connectPromise` (Postgres / SQLite) or in-flight `runtimePromise` (Mongo) pending.
3. **Connected** — driver bound; runtime active.
4. **Closed** — terminal. `close()` resolved; all subsequent surface calls reject with `Error('<target> client is closed')`.

State transitions:

- Idle → Closed: no-op (nothing to release); state still moves to Closed so subsequent surface calls reject.
- Connecting → Closed: `close()` sets `closed = true` first, then `await`s the in-flight connect (swallowing its error), then runs the owned-resource disposer.
- Connected → Closed: `close()` sets `closed = true` first, then runs the owned-resource disposer.
- Closed → anything: rejects with `Error('<target> client is closed')`.

### Ordering inside `close()`

The order is load-bearing:

1. If `closed` is already `true`, return early (idempotence).
2. Set `closed = true` immediately — so any concurrent `runtime()` / `connect(...)` / surface call rejects with the terminal error rather than racing teardown.
3. If a `connectPromise` / `runtimePromise` is in flight, `await` it inside a `catch(() => undefined)` so a connect that fails after we initiated close doesn't escape as an unhandled rejection.
4. If the facade captured an owned-resource disposer, `await` it. If not (Idle → Closed), the step is skipped.

This sequence forecloses on the three failure modes that otherwise show up: unhandled rejection from a dropped pending connect, pool leak from a dropped pending connect, and connect-after-close handing back an untracked runtime.

### Ownership tracking pattern

At the moment the facade constructs a resource it owns, it captures a disposer closure:

- **Postgres** — inside `toRuntimeBinding(...)` when `binding.kind === 'url'`, capture `() => pool.end()` and stash it on a facade-scoped `disposeOwned` ref.
- **SQLite** — equivalent shape; capture the driver's close routine at the point we own the file handle.
- **Mongo** — inside `buildRuntime(...)` when `resolvedBinding.kind === 'url'`, capture `() => mongoClientWeBuilt.close()`. When `resolvedBinding.kind === 'mongoClient'` (caller-supplied), skip the capture entirely.

On `close()`, the facade invokes only that captured disposer. If no disposer was captured (caller supplied their own pool / client / binding, or the facade was never connected), the disposer step is a no-op. Implementation detail of where exactly the capture happens is deferred to slice 1; either inside the binding-resolution function or via a separate ownership-tracking field on the facade closure is fine — both implement the same rule.

### Surface shape

```ts
export interface PostgresClient<TContract extends Contract<SqlStorage>> {
  readonly sql: Db<TContract>;
  readonly orm: OrmClient<TContract>;
  readonly context: ExecutionContext<TContract>;
  readonly stack: SqlExecutionStackWithDriver<PostgresTargetId>;
  connect(bindingInput?: PostgresBindingInput): Promise<Runtime>;
  runtime(): Runtime;
  transaction<R>(fn: (tx: PostgresTransactionContext<TContract>) => PromiseLike<R>): Promise<R>;
  prepare<…>(…): …;

  // NEW
  close(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
}
```

`SqliteClient` and `MongoClient` gain the same two members. `[Symbol.asyncDispose]` is declared on the interface (not attached via `Object.defineProperty` like `postgres-serverless` does — that pattern fits there because it wraps an externally-constructed `Runtime`; here we own the object literal and can declare the member directly).

### Post-close behaviour

After `close()` resolves:

- `db.sql.…` — the SQL builder is a static surface constructed once; calling `.build()` still produces a plan object (no transport touch). The next `runtime()` / `execute(...)` call rejects.
- `db.orm.…` — every terminal funnels through `getRuntime()` (lazy), which rejects.
- `db.runtime()` — rejects with `Error('<target> client is closed')`.
- `db.connect(...)` — rejects with `Error('<target> client is closed')` (no reconnect on a closed facade; construct a new `db`).
- `db.transaction(...)` / `db.prepare(...)` — funnel through `getRuntime()`; reject.
- `db.close()` again — no-op.
- `[Symbol.asyncDispose]()` — same as `close()`.

In-flight async iterators from `db.runtime().execute(plan)` and live `PreparedStatement` handles are an in-flight-work concern: the user should drain them before calling `close()`. Their behaviour after close is determined by the underlying driver (typically: the next `.next()` rejects when the pool is gone). The spec captures this as a usage guidance line; no per-surface guard is added.

### Error shape

`Error('<target> client is closed')` for v1 — plain JS `Error` matching mongo's currently-shipped string. Upgrading to the framework error envelope (`runtime/closed` or similar) is deferred until a wider policy surface justifies it; this is a state precondition, not a policy violation.

## Alternatives considered

- **`db.end()` (matching the `node-postgres` ecosystem name).** Rejected because `db` is not a `pg.Pool`; the name would mislead. Also forecloses the `Symbol.asyncDispose` convention which prefers `close()`. Original rationale in the ticket.
- **Push `close()` into `Runtime` / `RuntimeCore` and have the facade re-export it.** Rejected — `Runtime` has no concept of "facade owned this" vs "caller supplied this". Only the facade can apply the ownership rule. The framework `Runtime.close()` stays, but the facade does not call it.
- **Make `db.close()` always close the underlying driver regardless of who supplied the binding (mongo's current behaviour).** Rejected — silently disposes shared resources the caller still wants. The corrected mongo behaviour ships as a silent fix, called out in release notes; the repo has no test or internal consumer pinning the old behaviour.
- **Back-compat opt-in (`close({ closeExternal: true })`).** Rejected — ceremony that smudges cross-target symmetry for a behaviour no one is verified to depend on. Pre-1.0, small audience; silent fix is appropriate.
- **Skip `[Symbol.asyncDispose]` and ship only `close()`.** Rejected — marginal cost, big DX win on TS 5.2+; `postgres-serverless` already sets the precedent.
- **Plain `Error` vs framework error envelope for post-close.** `Error` chosen for v1; upgrade later if policy surface grows. Framework envelope would over-engineer a state precondition.
- **Cancel in-flight work when `close()` fires.** Rejected — out of scope; introduces driver-level cancellation surface that's a separate concern. `close()` is "release transport," not "abort queries."

## Open questions

Carried forward into slices, not blockers for spec finalisation.

- **Disposer capture site (implementation detail).** Inside `toRuntimeBinding(...)` (postgres) / `buildRuntime(...)` URL branch (mongo), or via a separate ownership-tracking field on the facade closure. _Working position:_ inside the binding-resolution function — captures the resource at the construction site, keeps ownership concerns adjacent to where the resource is built. Final shape lands in slice 1.
- **Skill-slice sequencing.** Co-ship slice 1 (framework) + slice 2 (skills) in one PR, or sequence. _Working position:_ co-ship if total diff stays under ~400 lines reviewable in one sitting; split otherwise. Decision lands at `drive-plan-project` time.

## References

- Project spec: [`./spec.md`](./spec.md)
- Project plan: [`./plan.md`](./plan.md)
- Linear ticket: [TML-2614](https://linear.app/prisma-company/issue/TML-2614/provide-dbclose-for-script-teardown-scripts-hang-at-end-and-agents)
- Facade sources:
  - `packages/3-extensions/postgres/src/runtime/postgres.ts`
  - `packages/3-extensions/sqlite/src/runtime/sqlite.ts`
  - `packages/3-extensions/mongo/src/runtime/mongo.ts`
- Existing in-repo `[Symbol.asyncDispose]` precedent: `packages/3-extensions/postgres/src/runtime/postgres-serverless.ts`
- Framework lifecycle reference: `docs/architecture docs/subsystems/4. Runtime & Middleware Framework.md` § "Connection Lifecycle"
- Mongo's existing in-flight close test (lifecycle precedent): `packages/3-extensions/mongo/test/mongo.test.ts:392`
