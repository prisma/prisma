# Manual QA: statements and transactions are activities (TML-3559)

## What this script is testing

The runtime now runs every statement and every transaction as an activity, and middleware observes it through `activityStarted`, `activityEnded` and `activityFinalized` (ADR 271). This script covers both consumer audiences:

- **Application author.** Runs `examples/prisma-8-demo` as a user would and checks that its middleware (cache, lints, budgets, slow-query warning) still behave as the README says.
- **Extension author.** Writes a new middleware from the upgrade instructions only, registers it on a runtime, and checks the order and outcomes of the hooks against ADR 271.

## Setup

1. A local Postgres with the `vector` extension available. Create an empty database, for example `createdb prisma_8_demo_qa`.
2. In `examples/prisma-8-demo`, write `.env` with `DATABASE_URL=postgresql://localhost:5432/prisma_8_demo_qa`.
3. `mise exec -- pnpm build` at the repository root.
4. In `examples/prisma-8-demo`: `pnpm emit`, `pnpm db:init`, `pnpm seed`, as the README says. Note the user ids the seed prints.

Save the output of every command under `wip/qa/`.

## Part A: application author

| Check | Command | Expected |
|---|---|---|
| A-1 | `pnpm start -- users` | Two seeded users print. |
| A-2 | `pnpm start -- cache-demo-user <aliceId>` | Second call much faster than the first; same row. |
| A-3 | `pnpm start -- cache-demo-users 5` | Same, for the ORM listing. |
| A-4 | `pnpm start -- cache-demo-sql 5` | Same, for the SQL builder query. |
| A-5 | `pnpm start -- budget-violation` | Fails with `BUDGET.ROWS_EXCEEDED`. |
| A-6 | `pnpm start -- guardrail-delete` | Blocked with `LINT.DELETE_WITHOUT_WHERE`. |
| A-7 | A statement slower than 250 ms through the demo's `slowQueryWarning` | An `APP.SLOW_QUERY` warning the user can see, with the SQL, latency and `activityId`. |
| A-8 | A query that returns more rows than `budgets({ maxRows })` | Fails with `BUDGET.ROWS_EXCEEDED` (the observed-row check now runs). With `severities: { rowCount: 'warn' }` in permissive mode, one warning and the rows. |
| A-9 | A statement slower than `budgets({ maxLatencyMs })` | Fails with `BUDGET.TIME_EXCEEDED`. |
| A-10 | An ORM write the ORM runs in a transaction (for example `repo-upsert-user`, or a nested create) | Succeeds; the tracer from Part B shows one transaction with its statements as children. |
| A-11 | `pnpm test` in the demo (unit and offline tests only; skip files that need the full integration harness if slow) | Passes. |

## Part B: extension author

Write `wip/qa/tracer.ts` from the upgrade instructions (`upgrade-instructions/pending/statement-and-transaction-activities/extension/instructions.md`) and ADR 271 only. The tracer:

- logs `started`, `ended` and `finalized` with `activity.id`, `activity.kind`, `activity.returns`, the parent's id (kept in the parent's `ctx.state` and read through `ctx.parent`), `ctx.inTransaction()` and the outcome;
- keeps its per-activity data in `ctx.state(Symbol)`;
- is registered on a `postgres({ contractJson, url, middleware })` client next to `lints()`.

Run these and compare against ADR 271:

| Check | Scenario | Expected |
|---|---|---|
| B-1 | A read outside any transaction | started, ended `succeeded`, finalized `committed`; no parent; `inTransaction()` false. |
| B-2 | A write outside any transaction (`execute()`) | Same, with `returns: 'stats'`. |
| B-3 | `db.transaction(fn)` with a read and a write, committed | Transaction starts first. Statements have the transaction as parent and `inTransaction()` true. Statements are finalized after the transaction ends, in start order, then the transaction. All `committed`. |
| B-4 | `db.transaction(fn)` whose callback throws | Every activity finalized `rolled-back`. The caller gets the callback's error. |
| B-5 | A `DELETE` without `WHERE` outside a transaction | started, ended `failed` with `latencyMs: 0` and `source: 'driver'`, finalized `unknown`. Caller gets `LINT.DELETE_WITHOUT_WHERE`. |
| B-6 | The same `DELETE` inside `db.transaction(fn)` | The statement fails; the transaction rolls back; all `rolled-back`. |
| B-7 | A row stream stopped after the first row, outside a transaction | ended `stopped`, finalized `unknown`. |
| B-8 | A row stream stopped early inside a committed transaction | ended `stopped`; finalized `committed` (a stopped child is not a failure). |
| B-9 | A row stream still open when its transaction commits (`connection().transaction()`, read one row, `commit()`, then finish the stream) | The transaction is finalized at commit; the open statement is finalized when it ends, with `committed`, and its `ctx.state` is still there. |
| B-10 | `activityEnded` throws after a successful statement | The caller receives that error. |
| B-11 | `activityFinalized` throws | The statement still succeeds; the error goes to `ctx.log.error`; later middleware still run. |
| B-12 | An annotated cached read run twice, then inside a transaction | Second run ends with `source: 'middleware'`. Inside a transaction the cache does not serve it (`source: 'driver'`). |
| B-13 | `ctx` identity | The same `ctx` object reaches every hook of one activity. |

## Pass criteria

Each check passes when what you see matches the Expected column. Record anything a user would find wrong, confusing or undocumented as a finding, including places where the upgrade instructions did not tell you what you had to write.

# Slice 2: clients start their own activities (TML-3560)

## What this part is testing

A client, such as an extension, can start its own activity, send statements beneath it, and end it. Middleware observe it through the same three hooks and can supply its result through `intercept.onActivity` (ADR 271, "Client activities" in the runtime subsystem doc). This part is for the **extension author** only. Use the upgrade instructions in `upgrade-instructions/pending/client-activities/extension/instructions.md` and the docs. Do not read the tests.

## Setup

1. As in slice 1, but in a new database, for example `createdb prisma_8_demo_qa2`, then the in-repo CLI's `db init` and `pnpm seed` with `DATABASE_URL` pointing at it.
2. A scratch folder `wip/qa2/` whose `node_modules` has the demo's packages plus `@prisma/orm-framework` and `@prisma/orm-family-sql` (symlinks into `packages/9-public/@prisma/`).
3. A script that registers a client kind, for example `report-run`, by augmenting `ClientActivityRegistry` in `@prisma/orm-framework/components/runtime`, and imports `startActivityOn` and `planContentHashOn` from `@prisma/orm-family-sql/runtime`.
4. Two middleware: a tracer that logs started, ended and finalized with ids and parent ids, and one with `intercept.onActivity` that serves `report-run` from a `Map` keyed by `contentHash` after the first call.

## Checks

| Check | Scenario | Expected |
|---|---|---|
| T-1 | Typecheck the script | Narrowing on `'statement'`, `'transaction'` and `'report-run'` compiles. `handle.intercepted.result` and `end({ result })` use the registered type. A kind without a hyphen, a reserved kind, and `startActivity` on `db.runtime()` do not compile. |
| C-1 | Start `report-run` on `db.runtime()`, hash from `planContentHashOn`, run a query on the handle, end it with a result | Activity starts, `onActivity` misses, the statement is its child and is finalized at once, the activity ends `source: 'client'` and is finalized `committed`. |
| C-2 | The same call again | `onActivity` serves it; ended `source: 'middleware'` with the stored result; finalized `committed`; no statement. |
| C-3 | `handle.transaction()`, two statements, `commit()`, then `end()` | The transaction is the handle's child; its statements, then it, are finalized `committed` at commit; the activity is finalized `committed` after it ends. |
| C-4 | The same with `rollback()` | Statements and transaction finalized `rolled-back`; the activity finalized `unknown`. |
| C-5 | Three nested activities outside a transaction | Each child's parent is the one above; each is finalized right after it ends. |
| C-6 | Activities started on `tx` inside `db.transaction(fn)`, nested, committed | No `transaction` property on the handle. Everything is finalized when the transaction ends, in post-order, then the transaction. |
| C-6b | The same, callback throws | Everything finalized `rolled-back`; caller gets the callback's error. |
| C-6c | A lint-blocked statement under a client activity in a transaction, then `commit()` | The statement, the activity and the transaction are finalized `unknown`. |
| C-7 | A prepared statement run with the handle as target | The statement is the handle's child. |
| C-8 | `planContentHashOn` for a query and an execute plan, compared with `ctx.contentHash(exec)` in `onQuery` and `onExecute` | Equal. |
| E-1 | `end()` while a row stream on the handle is open | Ends `failed`, finalized `unknown`, rejects `RUNTIME.ACTIVITY_CHILDREN_OPEN` with `openChildren: 1`; the stream is finalized when it ends. |
| E-2 | `query`, `execute`, `startActivity`, `transaction`, `end` on an ended handle | Each rejects `RUNTIME.ACTIVITY_ENDED`; no hook runs. |
| E-3 | Kind `'statement'` cast past the type | Rejects `RUNTIME.ACTIVITY_KIND_RESERVED`; no hook runs. |
| E-4 | A second `transaction()` on a connection handle while the first is open; a query on the handle meanwhile | `RUNTIME.TRANSACTION_ALREADY_OPEN`; `RUNTIME.ACTIVITY_OUTSIDE_TRANSACTION`. |
| E-5 | A handle opened on a connection whose transaction is already open | No `transaction` property; the activity is the transaction's child. |
| E-6 | `close()` with an open handle, then `end()` | `close()` waits, logs `runtime.close.waiting-for-activities`, and settles after `end()`. |

# Slice 3: ORM calls are activities, and the cache caches them (TML-3561)

## What this part is testing

Every SQL ORM terminal method now runs as one `orm-call` activity that carries the user's annotations, and its statements carry none. The cache middleware serves and stores whole annotated ORM calls through `intercept.onActivity`: a hit sends no statement, and a call is never served or stored inside a transaction or on a held connection. This part covers both audiences:

- **Application author.** Runs the demo's cache commands, a serializing cache store, and a hand-built runtime, using the cache and ORM READMEs and the app upgrade instructions (`upgrade-instructions/pending/orm-call-activities/app/instructions.md`).
- **Extension author.** Writes a tracer and an `intercept.onActivity` middleware from the extension upgrade instructions (`upgrade-instructions/pending/orm-call-activities/extension/instructions.md`) and the runtime subsystem doc. Do not read the tests.

## Setup

1. A Postgres database with `vector` available, new for this run, for example `createdb prisma_8_demo_qa3`. If the local Postgres refuses connections, a stateless `@prisma/dev` server started from the demo's `node_modules` works too.
2. `mise exec -- pnpm build` at the repository root.
3. In `examples/prisma-8-demo`: `.env` with `DATABASE_URL`, then `contract emit`, `db init` and `pnpm seed`. Note the user ids the seed prints.
4. A scratch folder `wip/qa3/` whose `node_modules` links the demo's packages plus `@prisma/orm-framework` and `@prisma/orm-family-sql`, as in slice 2. Save every command's output there.
5. A tracer middleware that logs started, ended and finalized with kind, parent, `inTransaction()`, scope, the user annotations on an `orm-call` activity, the user annotations on each statement's plan, and each ended result's `source` and `result`. Register it first, then an `intercept.onActivity` middleware that answers `orm-call` activities carrying a test annotation, then `createCacheMiddleware()` and `lints()`.

## Checks

| Check | Scenario | Expected |
|---|---|---|
| A-1 | `pnpm start -- cache-demo-user <aliceId>` | Second call much faster; same row. |
| A-2 | `pnpm start -- cache-demo-users 5` | Same, for the listing. |
| A-3 | The demo's `ormClientFindUserByIdCached` and `ormClientGetUsersCached`, run twice each on a runtime with the tracer | First call: one `orm-call` with one statement child. Second call: one `orm-call` ended `source: 'middleware'` with no statement child. |
| T-1 | Annotated `first()` | One `orm-call` with the annotation; its statement is a child and its plan carries no user annotation; ended with the row. |
| T-2 | Annotated `all()` | Same; ended with the rows. |
| T-3 | Annotated `aggregate()` and `groupBy().aggregate()` | Same; ended with the aggregate object or array. |
| T-4 | Annotated `create()` | One `orm-call`; the insert is its child. |
| T-5 | Annotated `update()` with a nested relation write (create or connect) | One `orm-call`; its own transaction is its child; the graph's statements are the transaction's children; the read-back is the call's child after the commit. |
| T-6 | Annotated `delete()` | One `orm-call`; its statements are its children. |
| T-7 | ORM read and write inside `db.transaction(fn)` | Each `orm-call` is the transaction's child and opens no transaction of its own; everything is finalized when the transaction ends. |
| T-8 | Annotated `all()` stopped after one row | The call and its statement end `stopped` and are finalized `unknown`. |
| T-9 | `intercept.onActivity` answers `first()` and `all()` | The caller gets the supplied value; the call ends `source: 'middleware'`; no statement. |
| T-10 | `intercept.onActivity` answers `first()` with a number | Rejects `ORM.INTERCEPTED_RESULT_INVALID`. |
| T-11 | `firstOrThrow()` with no row | The call ends `failed`; the caller gets `RUNTIME.NO_ROWS`. |
| K-1 | Annotated `first()` twice | Second call is served; no statement. |
| K-2 | Annotated `first()` that returns `null`, twice | `null` is stored and served. |
| K-3 | Annotated `firstOrThrow()` with no row, twice | Both reach the database; nothing is stored. |
| K-4 | Annotated read inside `db.transaction(fn)`: once with a key stored outside, once with a new key, then the new key outside | Inside, never served; the new key is a miss outside, so nothing was stored. |
| K-5 | `bypass: true` on a cached call | Reaches the database. |
| K-6 | A user `key` | Served by key, even to a different query (documented). |
| K-7 | `invalidate({ keys })`, then the same call | Miss. |
| K-8 | A SQL builder query and an ORM call with the same user key | The other kind is a miss. |
| K-9 | Annotated ORM read on `db.runtime().connection()`, twice | Scope `connection`; never served. |
| K-10 | Annotated `all()` read to the end, twice; and stopped early, then read fully | Read to the end: second is served. Stopped early: nothing stored. |
| K-11 | Mutate the result of a miss, then hit | The hit shows the original values. |
| P-1 | A prepared ORM `first()` with an email parameter, run for two emails, then both again | Two different content hashes; each execution is cached separately. |
| S-1 | The README's serializing store, with a serializer for `bigint`, `Date` and `Temporal.Instant`, on `Post` (`impressionCount`, `reachScore`, `createdAt`); then with plain JSON | With the app serializer, the hit returns the same types. With JSON, the problem the README warns about. |
| E-1 | `orm({ context, runtime: { query, execute } })` | Each terminal fails with `ORM.ACTIVITY_SOURCE_MISSING`; `all()` throws when called; the error's `fix` and the app upgrade instructions say what to do. |
| N-1 | No-middleware overhead: 2000 `first()` and 200 `all()` of 50 rows, several warm runs, this branch against `origin/main` | Medians and the percentage difference. Use a `git worktree` of `origin/main` under `wip/qa3/main-wt`, and remove it afterwards. |

## Pass criteria

Each check passes when what you see matches the Expected column. Record anything a user would find wrong, confusing or undocumented as a finding.

# Slice 4: a write carries its invalidation (TML-3400)

## What this part is testing

A write annotated with `invalidateAnnotation({ keys, meta })` makes the cache middleware call `invalidate({ keys, meta })` once the write's effects are final, in `activityFinalized`. A `committed` or `unknown` outcome invalidates; a `rolled-back` outcome leaves the entry. Inside `db.transaction(fn)` the invalidation runs when the transaction ends, not when the write ends. This part is for the **application author**: use the cache README ("Invalidating with a write"), the demo README and the ORM README. Do not read the tests.

## Setup

1. A Postgres database with `vector`, new for this run. If the local Postgres refuses connections, use a stateless `@prisma/dev` server started from the demo's `node_modules`, as in slice 3.
2. `mise exec -- pnpm build` at the repository root.
3. In `examples/prisma-8-demo`: `.env` with `DATABASE_URL`, then `contract emit`, `db init` and `pnpm seed`. Note the user ids the seed prints.
4. A scratch folder `wip/qa4/` whose `node_modules` links the demo's packages, as in slice 3. Save every command's output there.
5. A tracer middleware, registered before `createCacheMiddleware()`, that logs started, ended and finalized with kind, parent and outcome. To show when the store removes an entry, give the cache a store that wraps `createInMemoryCacheStore()` and logs each `unset` call.

## Checks

| Check | Scenario | Expected |
|---|---|---|
| W-1 | Cache a `User.first()` read, then an annotated `update()` outside a transaction, then the read again | The second read misses and shows the new value. The tracer shows the update's `orm-call` finalized `committed`, and `unset` runs after it, not before. |
| W-2 | An annotated `update()` with a relation callback (nested create), outside a transaction | The call's own transaction commits first; `unset` runs once, after the `orm-call` is finalized. The next read misses. |
| W-3 | Inside `db.transaction(fn)`: an annotated `update()`, then the cached read before the callback returns; after the commit, the read again | Inside: still a hit, showing the old value. `unset` runs after the transaction is finalized. After: a miss with the new value. |
| W-4 | The same as W-3, but the callback throws after the write | The caller gets the callback's error. Everything is finalized `rolled-back`; no `unset`. The next read is a hit. |
| W-5 | An annotated `create()` on a multi-table-inheritance variant (for example `Bug`) | Invalidates once, after the call is finalized. |
| W-6 | An annotated write that fails, for example a `create()` that violates a unique constraint | The caller gets the database error. The call is finalized `unknown`; the entry is removed. |
| W-7 | An annotated SQL builder `update` run with `db.runtime().execute(...)` | Invalidates from the statement activity; the next read misses. |
| W-8 | Several annotated writes with different keys in one `db.transaction(fn)` | Each key is removed when the transaction ends. |
| W-9 | Annotation with empty `keys` and no `meta` | No `unset`; nothing removed. |
| E-1 | `invalidateAnnotation` on a read terminal (`first`, `all`) and on a builder `select` | A type error. With the type bypassed, a run-time error whose message says what to do. |
| E-2 | `invalidateAnnotation({ keys, meta })` on the default store | As the README says: the write succeeds, `RUNTIME.CACHE_STORE_META_UNSUPPORTED` is logged through `middleware.activityFinalized.error`, and nothing is removed, not even `keys`. |
| E-3 | A store whose `unset` rejects | The write succeeds; the error is logged; the entry stays. |
| E-4 | A store whose `unset` takes 1.5 s | The write's promise resolves only after `unset` settles, as the README says. |
| D-1 | Demo README and `pnpm start` commands | Whether the demo shows invalidation with a write. |
| M-1 | Peak heap for one `db.transaction(fn)` that inserts 20,000 rows one statement at a time, with no middleware and with `createCacheMiddleware()` registered (no annotation) | Both numbers, each in its own process, and the difference. |

## Pass criteria

Each check passes when what you see matches the Expected column. Record anything a user would find wrong, confusing or undocumented as a finding.
