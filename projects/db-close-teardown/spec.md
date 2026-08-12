# Summary

Add a `db.close()` method (and symmetric `[Symbol.asyncDispose]`) to the user-facing `DB` facade returned by `postgres<Contract>(...)`, `sqlite<Contract>(...)`, and `mongo<Contract>(...)` so that short-lived scripts (the canonical first-touch onboarding shape) can release the resources the facade acquired on their behalf and exit cleanly.

Today the data round-trip succeeds but the session ends on either a hang (the Postgres `Pool` keeps the event loop alive) or a `TypeError` (the agent confabulates `db.end()` by inertia from the `node-postgres` ecosystem). The facade is the only place that knows what it acquired; this project adds the missing teardown surface there.

# Description

## Problem

Two failure modes, same root cause, observed on every first-touch onboarding run of the framework's quickstart shape:

**Face A — hang.** The Postgres facade (`packages/3-extensions/postgres/src/runtime/postgres.ts`) lazily constructs a `pg.Pool` inside `toRuntimeBinding(...)` when the user supplies `{ url }`. The pool keeps the Node event loop alive after the user's queries complete; the script never exits. Reproduced as OBS-003-06 in the onboarding audit (audit run-003).

**Face B — confabulated `db.end()`.** The agent reaches for the universal `node-postgres` teardown name (`pool.end()`) without checking whether the `db` surface exposes anything. The runtime doesn't expose `db.end()`, so the script throws `TypeError: db.end is not a function` *after* the data round-trip already succeeded. Reproduced as OBS-004-05 in audit run-004.

Both faces hit 100% of the canonical first-touch script shape. The data path works; the *experience of finishing* fails. That's the worst-possible last impression for an onboarding journey.

## Users and context

The user is a first-time consumer of the framework writing a short `tsx` script — typically the quickstart "connect → write → read → exit" shape that the `prisma-next-queries` / `prisma-next-runtime` skills teach. They are not running a long-lived server; they want the script to print and exit. The fix targets that script-shape use case; long-lived server consumers already manage lifecycle via process signals or framework hooks.

## Surface and scope

The change lives entirely at the **facade layer** — the `return { sql, orm, context, stack, … }` object at the bottom of:

- `packages/3-extensions/postgres/src/runtime/postgres.ts` — `PostgresClient<T>`
- `packages/3-extensions/sqlite/src/runtime/sqlite.ts` — `SqliteClient<T>`
- `packages/3-extensions/mongo/src/runtime/mongo.ts` — `MongoClient<T>` (already has `close()`; needs the ownership rule applied + `[Symbol.asyncDispose]`)

The framework runtime (`RuntimeCore.close()`, `SqlRuntimeImpl.close()`, driver close paths) is unchanged. The facade releases only what it itself acquired on the caller's behalf; if the caller supplied their own `pg.Pool` / `pg.Client` / `mongodb.MongoClient` / pre-opened binding, the facade leaves it alone.

# Requirements

## Functional Requirements

- `db.close(): Promise<void>` on `PostgresClient`, `SqliteClient`, `MongoClient`.
- `db[Symbol.asyncDispose](): Promise<void>` on the same three clients, aliasing `close()`. Declared on the interface (not attached via `Object.defineProperty`).
- **Idempotent.** `await db.close()` followed by `await db.close()` is a no-op; does not throw.
- **Ownership rule.** `close()` releases only resources the facade itself constructed (`pg.Pool` from `{ url }`, `MongoClient` from `{ url }` / `{ uri, dbName }`, SQLite handle from `{ path }`). Caller-supplied `pg.Pool` / `pg.Client` / `mongodb.MongoClient` / pre-built bindings are never disposed by the facade.
- **Terminal closed state.** After `close()` resolves, the facade is permanently locked. `db.runtime()` / `db.connect(...)` / ORM terminals / `db.transaction(...)` / `db.prepare(...)` reject with `Error('<target> client is closed')`. There is no reconnect on a closed facade — construct a new `db`.
- **Ordering inside `close()`.** Set `closed = true` first (so concurrent surface calls reject immediately); then `await` any in-flight `connectPromise` / `runtimePromise` while swallowing its error; then invoke the captured owned-resource disposer (no-op if no disposer was captured).
- **No effect on in-flight work.** Callers `await` any in-flight queries / iterators / prepared-statement executions before calling `close()`. `close()` does not abort outstanding work; cancellation is a separate concern.
- **Mongo behaviour shift (silent fix).** Mongo's current `close()` closes the driver indiscriminately even when `mongoClient` was caller-supplied. The corrected behaviour honours the ownership rule. Called out in release notes; no back-compat opt-in.

## Non-Functional Requirements

- Zero observable regression for callers that don't call `close()` (long-lived server use case).
- No change to framework runtime behaviour or middleware semantics.
- Calling `close()` mid-flight while a lazy connect is still pending must resolve cleanly (no unhandled rejection, no race).

## Non-goals

- Adding `close()` to `Runtime` / `RuntimeCore` (already exists at that layer; out of scope here).
- Closing externally-supplied `pg.Pool` / `pg.Client` / `mongodb.MongoClient` / external bindings (caller-owned).
- Aborting in-flight queries when `close()` is called (cancellation is a separate concern).
- A `db.end()` alias (the ticket's rationale picks `close()` for the AsyncDisposable convention and to avoid `pool.end()` namespace bleed).

# Acceptance Criteria

## Surface

- [ ] `close(): Promise<void>` lands on `PostgresClient`, `SqliteClient`, `MongoClient`.
- [ ] `[Symbol.asyncDispose](): Promise<void>` declared on the interfaces of all three; aliases `close()`.

## Quickstart-script exit

- [ ] A quickstart-shape script (connect → write → read → `await db.close()`) exits cleanly within Node's standard teardown window — for all three targets.
- [ ] The same script with `await using db = postgres<Contract>({...})` (and equivalents) exits cleanly on TS 5.2+ toolchains.

## Lifecycle correctness

- [ ] `close()` followed by `close()` is a no-op (does not throw); verified by test in each facade's package.
- [ ] `close()` while a lazy connect / runtime build is in flight resolves cleanly, with no unhandled rejection from the dropped pending promise. Verified by test in postgres and sqlite (mongo's equivalent test already exists at `mongo.test.ts:392`).
- [ ] `close()` always invokes the owned-resource disposer when one was captured, regardless of whether the in-flight connect succeeded or failed.

## Terminal state

- [ ] After `close()`, `db.runtime()`, `db.connect(...)`, ORM terminals (`db.orm.…`), `db.transaction(...)`, and `db.prepare(...)` all reject with `Error('<target> client is closed')` (target-named).

## Ownership rule

- [ ] When the caller supplied `pg.Pool` / `pg.Client` (Postgres `pg` option), `mongodb.MongoClient` (Mongo `mongoClient` option), or a pre-built binding, those resources are NOT touched by `db.close()`. Verified by test (caller's pool / client still usable after `db.close()`).
- [ ] When the facade constructed the resource (`{ url }`, `{ uri, dbName }`, `{ path }`), `db.close()` releases it.

## Mongo behaviour change

- [ ] Mongo's `close()` no longer closes a caller-supplied `MongoClient`. Release notes call this out as a behaviour change from the previous shipped behaviour.

## Skills

- [ ] `prisma-next-queries`, `prisma-next-runtime` teach the script-shape pattern (`await db.close()` and `await using db`).
- [ ] `prisma-next-debug` routes `TypeError: db.end is not a function` to the teardown section; matcher keywords updated per the ticket (`"script won't exit"`, `"hangs"`, `"close connection"`, `"db.end"`, `"db.close"`, `"pool.end"`, `[Symbol.asyncDispose]`, `await using`).
- [ ] Slice grouping (co-ship vs split) decided at `drive-plan-project` time.

# Adapter impact

- `packages/3-extensions/postgres/**` — `PostgresClient` gains `close()` + `[Symbol.asyncDispose]`.
- `packages/3-extensions/sqlite/**` — `SqliteClient` gains `close()` + `[Symbol.asyncDispose]`.
- `packages/3-extensions/mongo/**` — `MongoClient` gains `[Symbol.asyncDispose]`; existing `close()` revisited against the ownership rule.
- `packages/3-extensions/postgres/src/runtime/postgres-serverless.ts` — no change required (per-request lifecycle, already attaches `[Symbol.asyncDispose]` to the per-`connect()` `Runtime`); cross-reference in design-notes for consistency rationale.

No contract surface change; no ADR required (small consumer-facing surface refinement on the facade layer). Architectural framing captured in `design-notes.md` instead.

# References

- Linear ticket: [TML-2614](https://linear.app/prisma-company/issue/TML-2614/provide-dbclose-for-script-teardown-scripts-hang-at-end-and-agents)
- Linear project: `[PN] Onboarding Audit`
- Audit obstacles (out-of-worktree): `~/Projects/prisma/tml-2604-audit-the-onboarding-flow/run-003/obstacles.md` (OBS-003-06), `~/.../run-004/obstacles.md` (OBS-004-05)
- Existing precedent: `packages/3-extensions/postgres/src/runtime/postgres-serverless.ts` (attaches `[Symbol.asyncDispose]` to the per-request `Runtime`)
- Design notes: [`./design-notes.md`](./design-notes.md)

# Open Questions

Resolved into the design via `drive-discussion`; settled positions live in [`./design-notes.md`](./design-notes.md). Two carry-overs remain:

- **Disposer capture site (implementation detail).** Inside the binding-resolution function vs a separate ownership-tracking field on the facade closure. Both shapes implement the same rule. Settled in slice 1.
- **Skill-slice sequencing.** Co-ship slice 1 + 2 in one PR vs split. Settled at `drive-plan-project`.
