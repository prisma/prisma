# affected-row-counts

## Purpose

Make the ORM's count-returning write terminals report the number the database itself reports, from the statement that did the work. Today they infer it from a separate read, which is a different question asked at a different moment — so the answer can be wrong, and is always paid for twice.

## At a glance

`updateAndCount` runs two statements ([`collection.ts:2012`](../../packages/3-extensions/sql-orm-client/src/collection.ts)); `deleteAndCount` does the same ([`:2240`](../../packages/3-extensions/sql-orm-client/src/collection.ts)):

```ts
// 1. read every matching primary key into JS…
const matchingRows = await executeQueryPlan(this.ctx.runtime, countCompiled).toArray();
// 2. …then run the write, discarding whatever it reports
await executeQueryPlan(this.ctx.runtime, compiled).toArray();
return matchingRows.length;
```

Three consequences. The pair is not atomic — outside a transaction a concurrent insert is updated but not counted, a concurrent delete is counted but not updated. The filter is evaluated twice, and every matching primary key is materialised in JS purely to call `.length` on it. And the two `WHERE` clauses are built by different code paths (`compileSelect` vs `buildCountMutationWhere`, [`query-plan-mutations.ts:195`](../../packages/3-extensions/sql-orm-client/src/query-plan-mutations.ts)), which already drifted once for MTI variants (#940).

The count exists — we throw it away. Postgres reports it in the `CommandComplete` command tag; `pg-cursor` hands it to us as `read`'s third callback argument, which [`postgres-driver.ts:729`](../../packages/3-targets/7-drivers/postgres/src/postgres-driver.ts) drops. `SqlQueryResult.rowCount` is already in the driver interface ([`driver-types.ts:23`](../../packages/2-sql/4-lanes/relational-core/src/ast/driver-types.ts)) but only on `query()`, which nothing on the ORM path calls. SQLite surfaces `sqlite3_changes64()` only through `StatementSync.run()`.

The gap is structural: `RuntimeScope.execute()` returns `AsyncIterableResult<Row>` ([`runtime-core.ts:110`](../../packages/1-framework/1-core/framework-components/src/execution/runtime-core.ts)) — a row stream with nowhere for statement metadata to live. Every layer between driver and caller consumes its source with `for await`, so nothing survives the trip up.

## Non-goals

- **Streaming write terminals.** `update`, `updateAll`, `createAll`, `deleteAll` keep their `UPDATE … RETURNING` streaming path unchanged. Only the count terminals move.
- **`createAndCount`.** It returns `data.length` without asking the database ([`collection.ts:1671`](../../packages/3-extensions/sql-orm-client/src/collection.ts)). That is not currently wrong — the insert has no conflict clause, so it either inserts every row or throws — and the split-statement path ([`compileInsertCountSplit`](../../packages/3-extensions/sql-orm-client/src/query-plan-mutations.ts)) would need per-statement summing. Revisit if `ON CONFLICT DO NOTHING` ever reaches that path.
- **Unifying count semantics across targets.** Each engine defines "affected" differently — Mongo's `modifiedCount` excludes no-op writes ([`2-mongo-family/5-query-builders/orm/src/collection.ts:486`](../../packages/2-mongo-family/5-query-builders/orm/src/collection.ts)), Postgres's command tag does not. No translation layer, no normalized definition, no target changed to match another. The differences get documented, not reconciled.
- **New targets.** No MySQL work, and no accommodation for targets without `RETURNING` beyond what falls out of the design.
- **Prepared-statement coverage for count terminals**, if the chosen shape costs it. Named as an accepted loss, not silently dropped.

## Place in the larger world

- **Chosen execution shape — two methods, named the way Go names them.** Rows and statistics are different questions, so they get different calls:

  ```ts
  query<Row>(req): AsyncIterable<Row>          // rows
  execute(req):    Promise<SqlStatementStats>  // { affectedRows: number }
  ```

  `affectedRows` is **not optional**. Postgres always reports it in the `CommandComplete` tag for `INSERT`/`UPDATE`/`DELETE`; SQLite's `run()` always returns `changes`. Absence isn't a state either engine has for the statements this method exists to serve — so nothing downstream branches on `undefined`. `SqlStatementStats` is an object rather than a bare `number` because adding a field later (MySQL's matched-vs-changed) is non-breaking for third-party driver authors, while widening a return type is not.

  Two obligations become contract text rather than optionality: `execute()` takes a **single statement** (multi-statement SQL through pg's simple protocol resolves to `Result[]` and the guarantee dissolves), and **DDL / control statements do not go through it** (they have no row-count tag, and the migration plane has its own interface). Both are free — ORM plans are single DML statements.

  This also means statistics never travel through a row stream, so the seven `for await` re-wrap sites between driver and caller stop being a hazard: there is nothing in flight for them to drop.

- **Prepared-ness is a property of the request, not a separate method.** A naive split yields four methods (`query`/`queryPrepared`/`execute`/`executePrepared`) where prepared-ness contributes exactly one thing. Instead the slot rides on the request, keeping the SPI two methods wide:

  ```ts
  interface PreparedStatementHandle { get(): unknown; set(value: unknown): void }

  interface SqlExecuteRequest {
    readonly sql: string;
    readonly params?: readonly unknown[];
    readonly preparedStatementHandle?: PreparedStatementHandle;  // absent ⇒ ad-hoc
  }
  interface PreparedExecuteRequest extends SqlExecuteRequest {
    readonly preparedStatementHandle: PreparedStatementHandle;   // required
  }
  ```

  The handle's value stays **`unknown`** — ADR 210 principle #3 makes opacity load-bearing ("the driver allocates whatever per-target handle it needs — a name, a statement reference, an integer, anything"). Narrowing it to `string` would encode one target's preparation primitive into a cross-target SPI. Where the driver narrows its own handle, that is the driver's business.

  **Two levels of "unset", and they must not be conflated.** The slot's *presence* marks preparedness; the slot's *value* is the lazily-minted handle. A prepared statement on first execute has a slot whose `get()` returns `undefined` — which is why the marker has to be the slot object and not the handle itself. Flatten it to `preparedStatementHandle?: string` and "prepared, not yet minted" becomes indistinguishable from "ad-hoc".

  **The driver branches on the value, never with `in`.** `'preparedStatementHandle' in req` is a key-presence test, so `{ preparedStatementHandle: undefined }` takes the prepared branch and throws on `.get()`. `exactOptionalPropertyTypes` (on repo-wide, `packages/0-config/tsconfig/base.json`) rejects that literal at compile time, but `SqlQueryable` is a published SPI reachable from untyped callers. `req.preparedStatementHandle === undefined` treats absent and illegally-undefined identically, and needs no cast — which matters, since bare `as` is banned in production code.

  Two independent pieces of evidence that the split method was never carrying weight: SQLite's `executePrepared` is a pure delegate to `execute` ([`sqlite-driver.ts:84`](../../packages/3-targets/7-drivers/sqlite/src/sqlite-driver.ts), [`:157`](../../packages/3-targets/7-drivers/sqlite/src/sqlite-driver.ts)), and postgres's falls through whenever prepared statements are disabled ([`postgres-driver.ts:173`](../../packages/3-targets/7-drivers/postgres/src/postgres-driver.ts)).
- **Runtime API mirrors the driver vocabulary** (operator decision, 2026-08-06; prerequisite design for Slice 2). Direct SQL runtime callers choose the semantic operation explicitly: `query(plan, options)` streams decoded rows and `execute(plan, options)` returns `SqlStatementStats`. The current row-returning `executePrepared(statement, params, options)` becomes `queryPrepared(statement, params, options)`. A statistics-returning prepared operation is not added speculatively; if a prepared DML caller emerges, it will be named `executePrepared` and route the same request handle through the driver. The runtime must not infer the operation from SQL text, AST shape, generic result type, or the `SqlQueryPlan`/`SqlExecutionPlan` distinction—those types describe lowering state, not row-vs-statistics semantics.
- **Driver SPI.** `SqlQueryable` ([`driver-types.ts:82`](../../packages/2-sql/4-lanes/relational-core/src/ast/driver-types.ts)) is exported from `relational-core/src/exports/ast.ts`, so any shape change is a break for third-party driver authors. At 0.x with no back-compat policy that is acceptable; it gets more expensive every release. The slice that reshapes it also **fixes the `execute`/`query` naming inversion** — every prior art puts `execute` on the non-row side (JDBC `executeQuery`/`executeUpdate`, ADO.NET `ExecuteReader`/`ExecuteNonQuery`, Go `Query`/`Exec`) and ours is inverted on both halves. The chosen shape resolves this by construction rather than as a separate rename — the two methods land already named correctly.
- **Separate surface, untouched.** The migration/control plane uses `SqlControlDriverInstance.query` ([`sql-contract/src/types.ts:7`](../../packages/2-sql/1-core/contract/src/types.ts)) with its own implementations (`PostgresControlDriver`, `SqliteControlDriver`). None of its ~500 call sites are in scope.
- **Middleware contract** (operator decision, 2026-08-07). Query and statistics operations have symmetric, operation-specific hooks: `beforeQuery` / `interceptQuery` / `afterQuery` and `beforeExecute` / `interceptExecute` / `afterExecute`; `onRow` remains query-only and SQL `beforeCompile` remains shared. `QueryInterceptResult` retains the pre-PR `{ rows }` shape, while `ExecuteInterceptResult` is `{ stats: RuntimeStatementStats }`. The first non-`undefined` interceptor still wins and skips the matching driver terminal. Hook selection carries the operation distinction, so context and result values have no operation discriminator. The split is a compatibility-free hard cut with no aliases or generic fallback hooks.
- **[ADR 210 — Prepared Statements](../../docs/architecture%20docs/adrs/ADR%20210%20-%20Prepared%20Statements%20-%20Author%20Surface%20and%20Driver%20SPI.md) is Accepted and this project changes its SPI shape.** Every principle it states survives: the slot stays opaque to the runtime, allocation stays lazy and synchronous, a driver may still ignore the slot entirely, and `preparedStatements: false` still leaves it unset. What changes is the shape those principles were expressed through — the ADR pins `executePrepared` as its own method on `SqlQueryable` (§Driver SPI) and justifies the surface as "a three-field record" (§Why a slot wrapper). So the project owes ADR 210 an **amendment**, not a fresh ADR; the amendment restates the same guarantees over a two-method surface.
- **[ADR 023 — Budget Evaluation](../../docs/architecture%20docs/adrs/ADR%20023%20-%20Budget%20Evaluation.md)** already assumes a "post factum rowCount when available" for write budgets. This project is what makes that real.
- **Prior art.** Kysely splits `executeQuery` (rows + `numAffectedRows`) from `streamQuery`; Drizzle passes the driver's native result through per-dialect; ADO.NET's `DbDataReader` streams rows *and* exposes `RecordsAffected`, documented as valid only after the reader is drained. The "count is a completion-time value" constraint is not ours — it is the wire protocol's.

## Contract impact

None. No contract entity, kind, or capability changes; `contract.json` / `contract.d.ts` output is unaffected. Note that count terminals deliberately do **not** assert the `returning` capability (unlike `updateAll`, [`collection.ts:1955`](../../packages/3-extensions/sql-orm-client/src/collection.ts)) — that stays true.

## Adapter impact

- **postgres driver** — `execute()` is the buffered path; `rowCount` comes straight off pg's result. The cursor stays exactly as it is: because statistics no longer ride the row stream, the count never has to be extracted from `readCursor`'s discarded third callback argument. That work disappears from the project.
- **sqlite driver** — `execute()` is `stmt.run()`, whose `changes` is `sqlite3_changes64()`. `stmt.columns().length === 0` is retained as a **guard, not a router**: `run()` on a `RETURNING` statement executes it and silently discards the rows, so a misrouted plan must fail loudly rather than lose data. Separately, `SqliteConnectionImpl` ([`:66`](../../packages/3-targets/7-drivers/sqlite/src/sqlite-driver.ts)) and `SqliteTransactionImpl` ([`:139`](../../packages/3-targets/7-drivers/sqlite/src/sqlite-driver.ts)) duplicate every method verbatim; they get the abstract-base treatment postgres already has ([`postgres-driver.ts:150`](../../packages/3-targets/7-drivers/postgres/src/postgres-driver.ts)).
- **supabase runtime** — implements the scope surface ([`supabase-runtime.ts:154`](../../packages/3-extensions/supabase/src/runtime/supabase-runtime.ts)); gains the statistics method.
- **mongo runtime** — no behaviour change; in scope only to document the semantic difference and, if the chosen shape makes it free, to retire the `blindCast<{ modifiedCount }>` smuggling a count through as a fake row.

## Cross-cutting requirements

- **No fabricated count.** `execute()` always returns a real number. `interceptExecute` can short-circuit the driver only by returning `{ stats: RuntimeStatementStats }`; it cannot return rows, and no runtime path derives `affectedRows` from row length.
- **Writes are not second-class.** Statistics execution gets its own `beforeExecute` / `interceptExecute` / `afterExecute` lifecycle with the same pre-PR ordering, interception, completion, and error semantics as the query lifecycle. Both paths retain codec encoding, plan validation, abort handling, telemetry, scope, and fresh `planExecutionId`; `onRow` remains query-only.
- **Transaction scope is preserved.** Count terminals inside `db.transaction(...)` run on the transaction's pinned connection, not a second pooled one.
- **Each target reports its own engine's count; no normalization layer.** Postgres's command tag counts matched rows (including updates that changed nothing), SQLite's `sqlite3_changes64()` counts rows the statement modified, Mongo's `modifiedCount` excludes no-op writes. The project does not reconcile these into a single definition, and no code translates between them. What it owes instead is documentation: each target's meaning stated where a user reading that target's docs will find it.
- **Every `RuntimeScope` exposes both methods.** The transaction context ([`sql-runtime.ts:790`](../../packages/2-sql/5-runtime/src/sql-runtime.ts)), supabase, and mongo each implement `query` for rows and `execute` for statistics; a scope missing either method is a compile error rather than a silent hole, which is the point of returning statistics directly instead of threading them through a stream.
- **The prepared/unprepared duplication shrinks, not grows.** The split must not leave four driver methods where there were two, four runtime generators where there were two, or SQLite's connection and transaction classes each carrying their own copy of every method.
- **The prepared path ends up conformant with the ADR it is amending.** ADR 210 §Stale-handle retry requires that a failed retry surface a stable-code envelope with the originating error as `cause`. It is currently emitted **nowhere in the codebase**: `withStaleHandleRetry` rethrows a generic normalised error ([`postgres-driver.ts:214`](../../packages/3-targets/7-drivers/postgres/src/postgres-driver.ts)). Rewriting the surrounding code while leaving a known violation of the ADR being amended is incoherent, so closing it is in scope rather than a follow-up.

  **The code is `DRIVER.PREPARE_FAILED`, not `ADAPTER.PREPARE_FAILED`** (operator decision, 2026-08-05, at D1 review). ADR 210 and ADR 027 both name `ADAPTER.PREPARE_FAILED`, but [ADR 239](../../docs/architecture%20docs/adrs/ADR%20239%20-%20Errors%20are%20structural%20envelopes%20with%20dotted%20namespace%20codes.md) (Accepted, 2026-07-21) **supersedes ADR 027** and closes the namespace list — `ADAPTER` is not on it; `DRIVER` is, defined as "Driver / adapter transport + error normalization." `ADAPTER.PREPARE_FAILED` appears nowhere in ADR 239's crosswalk: it is a gap left by ADR 210 predating ADR 239, not a deliberate carry-forward. ADR 239 is implemented (`structuredError` / `isStructuredError` in `packages/1-framework/0-foundation/utils/src/structured-error.ts`), and both drivers already emit `DRIVER.NOT_CONNECTED` / `DRIVER.ALREADY_CONNECTED`. Envelopes use that idiom — **not** the legacy `runtimeError`, whose `category` field ADR 239 deleted ("the namespace *is* the category"). Correcting ADR 210's stale-retry wording rides with the amendment this project already owes it.

## Transitional-shape constraints

- The pre-`SELECT` fallback stays in place until **both** shipped drivers report a count. No intermediate slice may ship a terminal whose count silently degrades.
- A driver-SPI change lands with **both** postgres and sqlite in the same slice. No half-migrated driver on `main`.
- Every slice keeps `pnpm test:integration` and `pnpm test:e2e` green — these are the only gates that exercise a real driver.

## Project Definition of Done

- [ ] Team-DoD floor items (inherited; see [`drive/calibration/dod.md`](../../drive/calibration/dod.md)).
- [ ] `updateAndCount` and `deleteAndCount` issue exactly one statement, proven by a test that counts statements through middleware — not by reading the source.
- [ ] An integration test demonstrates the count comes from the write itself: a row inserted between what *would* have been the read and the write is reflected in the returned number.
- [ ] Both shipped drivers return a real `affectedRows` from `execute()`, with a test pinning the behaviour each relies on — pg's command-tag count, sqlite's `run()` guard against a misrouted `RETURNING` statement.
- [ ] The driver SPI is **two** methods wide, not four: a prepared statement is a request with a handle, not a separate call. SQLite's connection and transaction classes no longer carry duplicate method bodies, and the runtime's prepared and unprepared execution paths are one code path.
- [ ] The pre-`SELECT` fallback is deleted, not left dormant.
- [ ] `SqlQueryable`'s row-returning and non-row methods are named the way every prior art names them; no call site or fake still references the inverted pair.
- [ ] ADR 210 is amended to describe the two-method surface, and its principles read true against the shipped code — including the stale-retry contract, whose `DRIVER.PREPARE_FAILED` envelope is emitted by a driver rather than existing only on paper. The amendment also corrects ADR 210's own reference to the abolished `ADAPTER` namespace.
- [ ] [`scorecard/06-sql-orm-client.md`](../../scorecard/06-sql-orm-client.md) and [`scorecard/07-mongodb-query-and-orm.md`](../../scorecard/07-mongodb-query-and-orm.md) reflect the settled semantics.

## Open Questions

None. Three questions were settled by the operator at spec time and moved into the body:

- **Execution shape: `query()` streams rows, `execute()` returns statistics** — see Place in the larger world § Chosen execution shape. (An earlier position — a single `execute()` yielding row/metadata frames — was considered and reversed: it gave statistics a home inside the stream at the cost of making every layer demux, when the two questions simply want two calls.)
- **The naming falls out of the shape** rather than being a separate rename: `query` returns rows and `execute` returns a count, as in Go's `Query`/`Exec`.
- **Count semantics follow each driver; no unification** — see Cross-cutting requirements.

## References

- Linear Project: [Prisma 8 RC1](https://linear.app/prisma-company/project/prisma-8-rc1-7592265f700c) — parent issue [TML-3166](https://linear.app/prisma-company/issue/TML-3166), one sub-issue per slice. See [`plan.md`](./plan.md) § Dependencies.
- ADRs: [ADR 210 — Prepared Statements](../../docs/architecture%20docs/adrs/ADR%20210%20-%20Prepared%20Statements%20-%20Author%20Surface%20and%20Driver%20SPI.md) (amended by this project); [ADR 239 — Errors are structural envelopes with dotted namespace codes](../../docs/architecture%20docs/adrs/ADR%20239%20-%20Errors%20are%20structural%20envelopes%20with%20dotted%20namespace%20codes.md) (Accepted; governs the error code — supersedes [ADR 027](../../docs/architecture%20docs/adrs/ADR%20027%20-%20Error%20Envelope%20Stable%20Codes.md), which ADR 210 still cites); [ADR 023 — Budget Evaluation](../../docs/architecture%20docs/adrs/ADR%20023%20-%20Budget%20Evaluation.md) (consumer of the new count).
- Upstream constraint: [nodejs/node#59764](https://github.com/nodejs/node/issues/59764) — Node's position that the caller must know what kind of statement it is running; `sqlite3_changes` has never been requested as a standalone binding, so `run()` is the only route.
- Sibling surfaces: [`docs/architecture docs/subsystems/`](../../docs/architecture%20docs/subsystems/) — Query Lanes, Runtime & Middleware Framework, Adapters & Targets.
