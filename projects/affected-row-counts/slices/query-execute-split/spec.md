# Slice: query-execute-split

Parent project: `projects/affected-row-counts/`. Contributes the substrate the project's purpose rests on — a driver that can answer "how many rows did that affect" — without changing any ORM-visible behaviour.

## At a glance

`SqlQueryable` stops being four methods that answer two questions badly and becomes two that answer them directly: `query()` streams rows, `execute()` returns `SqlStatementStats`. Prepared-ness moves onto the request, so `executePrepared` disappears from both drivers, the runtime, and 18 test fakes. Nothing above the runtime changes — the count terminals still run their pre-`SELECT` when this merges.

## Chosen design

### The interface, before and after

Today (`packages/2-sql/4-lanes/relational-core/src/ast/driver-types.ts:82`):

```ts
export interface SqlQueryable {
  execute<Row>(request: SqlExecuteRequest): AsyncIterable<Row>;          // rows
  executePrepared<Row>(request: PreparedExecuteRequest): AsyncIterable<Row>;  // rows
  explain?(request: SqlExecuteRequest): Promise<SqlExplainResult>;
  query<Row>(sql: string, params?: readonly unknown[]): Promise<SqlQueryResult<Row>>;  // buffered
}
```

After:

```ts
export interface SqlStatementStats {
  readonly affectedRows: number;
}

export interface PreparedStatementHandle {
  get(): unknown;
  set(value: unknown): void;
}

export interface SqlExecuteRequest {
  readonly sql: string;
  readonly params?: readonly unknown[];
  readonly preparedStatementHandle?: PreparedStatementHandle;
}

export interface PreparedExecuteRequest extends SqlExecuteRequest {
  readonly preparedStatementHandle: PreparedStatementHandle;
}

export interface SqlQueryable {
  query<Row>(request: SqlExecuteRequest): AsyncIterable<Row>;
  execute(request: SqlExecuteRequest): Promise<SqlStatementStats>;
  explain?(request: SqlExecuteRequest): Promise<SqlExplainResult>;
}
```

Three things this does at once, which is why they are one slice:

1. **Fixes the naming inversion.** Today `execute` streams rows and `query` is the buffered one — inverted against every prior art (JDBC `executeQuery`/`executeUpdate`, ADO.NET `ExecuteReader`/`ExecuteNonQuery`, Go `Query`/`Exec`). The new names land correct by construction rather than as a follow-up rename.
2. **Collapses prepared-ness onto the request.** `PreparedExecuteRequest` gains the slot and *extends* `SqlExecuteRequest` (today it does not — it redeclares `sql` and makes `params` required). Renaming `handle` → `preparedStatementHandle` is what makes the field meaningful on a request type that is no longer prepared-specific.
3. **Retires the buffered `query(sql, params)`.** Its only ORM-path value was `rowCount`, which is exactly what the new `execute()` returns — as a required `number` rather than `number | null | undefined`.

`SqlQueryResult` is deleted along with the buffered method. Its `readonly [key: string]: unknown` index signature is why `PostgresQueryable.query` can `return result as unknown as SqlQueryResult<Row>` — the new `SqlStatementStats` is a closed two-field shape that the postgres driver populates explicitly.

### Two levels of "unset"

The slot's **presence** marks preparedness; the slot's **value** is the lazily-minted handle. A prepared statement on first execute has a slot whose `get()` returns `undefined` — so the marker must be the slot object, not the handle. Flattening to `preparedStatementHandle?: string` would make "prepared, not yet minted" indistinguishable from "ad-hoc".

Drivers branch on `req.preparedStatementHandle === undefined`, **never** with `in`. Key-presence would send `{ preparedStatementHandle: undefined }` down the prepared path and throw on `.get()`. `exactOptionalPropertyTypes` rejects that literal at compile time, but `SqlQueryable` is exported from `relational-core/src/exports/ast.ts` and reachable from untyped callers. The `=== undefined` form also needs no cast, which matters given the bare-`as` ban.

### Driver-side

**Postgres** (`packages/3-targets/7-drivers/postgres/src/postgres-driver.ts`). The `PostgresQueryable` abstract base already exists (`:150`) with four subclasses; the shape is right, only the methods move. `execute()` is the buffered path — `rowCount` straight off pg's result, no cursor involved. The cursor stays exactly as it is: because statistics no longer ride the row stream, nothing needs extracting from `readCursor`'s discarded third callback argument. That work, which the project spec once scoped, disappears.

The prepared fall-through at `:173` (skip server-side prepare when `preparedStatementsEnabled` is false) becomes an internal branch of `query()` rather than a separate method. The `handle as string` bare cast at `:185` should not survive the rewrite — the driver narrows its own handle, so the narrowing belongs where the handle is minted.

**SQLite** (`packages/3-targets/7-drivers/sqlite/src/sqlite-driver.ts`). `execute()` is `stmt.run()`, whose `changes` is `sqlite3_changes64()`. `stmt.columns().length === 0` is retained as a **guard, not a router**: `run()` on a `RETURNING` statement executes it and silently discards the rows, so a misrouted plan must fail loudly rather than lose data.

`SqliteConnectionImpl` (`:66`) and `SqliteTransactionImpl` (`:139`) currently duplicate `execute`, `executePrepared`, `explain`, and `query` **verbatim** — four method bodies written twice. They get the abstract-base treatment postgres already has. Note `SqliteConnectionImpl` is exported and `SqliteTransactionImpl` is not; the base class stays package-private either way.

### Runtime-side

`executeAgainstQueryable` (`sql-runtime.ts:386`) and `executePreparedAgainstQueryable` (`:531`) are near-identical: same `ensureCodecRegistryValidated`, same `codecCtx`, same `execMiddlewareCtx` with its own minted `planExecutionId`, same terminal `self.streamRows(...)`. They differ in exactly two places — how `exec` is built (AST-lower-and-encode vs. resolve-prepared-slots-and-encode) and which driver method the thunk calls (`:472` vs `:602`). With prepared-ness on the request, the thunk becomes one call and the two generators merge into one path parameterised by how `exec` is produced.

`RuntimeScope` is `Pick<RuntimeExecutor<SqlOrmPlan>, 'execute'>` (`relational-core/src/runtime-scope.ts:20`) — a **runtime-level** surface, distinct from the driver-level `SqlQueryable`. This slice does not touch it. Adding a statistics method to every `RuntimeScope` is slice 2's work.

> **Naming collision, deliberate and temporary.** After this slice `SqlQueryable.execute` returns statistics while `RuntimeScope.execute` still streams rows. Different interfaces at different layers; the reviewer should expect it rather than read it as a mistake.

## Coherence rationale

One interface changes shape and every implementation and fake follows it in the same commit range. The moment `SqlQueryable` changes, both drivers, the runtime's two generators, and all 18 test fakes stop compiling — there is no ordering of those pieces that leaves a green `main` in between, so any split produces slices that cannot merge independently. This is the repo's hard-cut migration shape: one substrate concept, its conforming implementations, and the fakes that stand in for them. Its size is footprint, not incoherence — a reviewer holds one idea ("the SPI splits along the question being asked") and reads the rest as mechanical consequence.

## Scope

**In:**

- `packages/2-sql/4-lanes/relational-core/src/ast/driver-types.ts` — the interface, `SqlStatementStats`, `PreparedStatementHandle`, the reshaped request types; `SqlQueryResult` deleted.
- `packages/3-targets/7-drivers/postgres/src/postgres-driver.ts` — `PostgresQueryable` + four subclasses; `postgres/src/exports/runtime.ts`.
- `packages/3-targets/7-drivers/sqlite/src/sqlite-driver.ts` — both queryable classes + the abstract base they're missing.
- `packages/2-sql/5-runtime/src/sql-runtime.ts` — the two generators merged; `prepared/prepared-statement.ts`.
- `packages/3-extensions/supabase/src/runtime/supabase-runtime.ts` — the scope surface and its three raw-connection `query()` call sites.
- The 18 test files carrying a driver fake (12 in `packages/2-sql/5-runtime/test/`), 96 `executePrepared` occurrences repo-wide.
- The `ADAPTER.PREPARE_FAILED` conformance fix — **its own dispatch**, not folded into the SPI diff.

**Out:**

- Any ORM-visible behaviour change. `updateAndCount` / `deleteAndCount` keep their pre-`SELECT`; no terminal changes.
- `RuntimeScope` gaining a statistics method — slice 2.
- The migration/control plane. Verified separate: `packages/3-targets/3-targets/{postgres,sqlite}/src/core/migrations/runner.ts` are typed against `SqlControlDriverInstance` (`@internal/sql-contract/types`), not `SqlQueryable`. Its ~500 `driver.query(...)` call sites do not move.
- Mongo. No `SqlQueryable` implementation.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| Supabase's three raw-connection `query()` calls | Route to `query()` and drain | `openRoleSession` issues `SELECT set_config($1,$2,false)` twice and `RESET ALL` once against a raw `SqlConnection` (`supabase-runtime.ts:41`, `:42`, `:125`) — the buffered method this slice deletes. These are session-control statements, and the spec reserves `execute()` for single DML with a real count. `SELECT set_config` genuinely returns a row; `RESET ALL` returns none and draining is a no-op. Not discoverable by grepping `SqlQueryable` alone — it looks like control-plane code but runs on the runtime's connection. |
| `run()` on a `RETURNING` statement | Guard, must fail loudly | Node's `StatementSync.run()` executes the statement and discards rows silently. A misrouted plan would lose data rather than error, so `columns().length === 0` stays as an assertion. Upstream position ([nodejs/node#59764](https://github.com/nodejs/node/issues/59764)): the caller must know what kind of statement it is running; `sqlite3_changes` has never been exposed standalone. |
| Grounding illustrative snippets | Re-verify before coding | Per `drive/spec/README.md` § Grounding illustrative snippets, TML-2500 hit spec-sketch-vs-shipped-code drift four times. The interface block above is transcribed from today's `driver-types.ts`, but line numbers move — implementers read the file, not this spec. |

## Slice-specific done conditions

- [ ] `grep -rn 'executePrepared' --include='*.ts' packages/ test/` returns zero results outside `node_modules`/`dist` (baseline: 96 occurrences across 25 files).
- [ ] `SqlQueryResult` is deleted, not left unreferenced.
- [ ] `ADAPTER.PREPARE_FAILED` is emitted by the postgres driver and asserted by a test — it currently appears only in ADR 210, ADR 027, and this project's docs, never in source.
- [ ] Both drivers have a test pinning the count source each relies on: pg's command-tag `rowCount`, sqlite's `run().changes` plus the `RETURNING`-misroute guard.
- [ ] `pnpm lint:deps` clean (the SPI is an exported surface; imports move).
- [ ] No net increase in bare-`as` casts — the `handle as string` at `postgres-driver.ts:185` should go, not be relocated.

## Contract impact

None. No contract entity, kind, or capability changes; `contract.json` / `contract.d.ts` output is unaffected.

## Adapter impact

- **postgres driver** — reshaped; `execute()` reads `rowCount` off the buffered result. Cursor path untouched.
- **sqlite driver** — reshaped; `execute()` is `stmt.run()`. Gains the abstract base it lacks.
- **supabase runtime** — implements the scope surface; three raw-connection call sites rehomed (see edge cases).
- **mongo** — not touched. No `SqlQueryable` implementation.

## Open Questions

1. **Does `explain?` stay optional on the two-method surface?** Working position: yes, unchanged. It is genuinely optional (postgres and sqlite both implement it; third-party drivers need not), and folding it in would widen the slice for no gain. "Two methods wide" in the project-DoD means the two DML methods, not a literal count including `explain?`.

## References

- Parent project: `projects/affected-row-counts/spec.md`
- Linear issue: [TML-3167](https://linear.app/prisma-company/issue/TML-3167) (sub-issue of [TML-3166](https://linear.app/prisma-company/issue/TML-3166))
- [ADR 210 — Prepared Statements](../../../../docs/architecture%20docs/adrs/ADR%20210%20-%20Prepared%20Statements%20-%20Author%20Surface%20and%20Driver%20SPI.md) — amended by this project; principles preserved, shape changed. `§ Stale-handle retry` is the conformance target.
- [ADR 027 — Error Envelope Stable Codes](../../../../docs/architecture%20docs/adrs/ADR%20027%20-%20Error%20Envelope%20Stable%20Codes.md) — reserves `ADAPTER.PREPARE_FAILED`.
- [ADR 220](../../../../docs/architecture%20docs/adrs/) — `planExecutionId` minted per execute call; both generators do this independently today and the merged path must preserve it.
