
# Prisma Next — Failure Modes (Structured Errors)

> **Edit your data contract. Prisma handles the rest.**

When a Prisma Next call fails, the framework returns a **structured envelope**. The agent's job is to read the envelope, route on the `code`, and chain to the right authoring skill for the actual fix. This skill teaches the envelope shapes and the routing — it does not duplicate sibling-skill workflows.

## When to Use

- User pastes an error envelope (CLI failure, runtime exception, `--json` output).
- User says *"my query won't typecheck"*, *"my migration won't apply"*, *"my emit failed"*, *"the runtime crashed"*.
- User mentions a stable code (`CLI.*`, `CONFIG.*`, `CONTRACT.*`, `MIGRATION.*`, `LINT.*`, `BUDGET.*`, `PLAN.*`, `RUNTIME.*`).
- User mentions: *Studio, EXPLAIN, query log, prepared statements, drift, hash mismatch, capability, planner*.

## When Not to Use

- User wants to author a query / model / migration → the matching authoring skill.
- User wants to *prevent* errors (lints, budgets, type-level guards) → `references/runtime.md`.
- User wants the framework changed because the surface itself is the problem (no envelope to route on, capability genuinely missing) → `references/feedback.md`.

## Key Concepts

### Two envelope shapes

Prisma Next emits **two distinct envelopes** depending on which seam threw. Read which one you have *before* routing.

**1. CLI envelope** — produced by `prisma ...` commands (emit, db init/update/verify/sign/schema, migration plan/apply/show/status, init). Shape (see `CliErrorEnvelope` in `packages/1-framework/1-core/errors/src/control.ts`):

```json
{
  "ok": false,
  "code": "MIGRATION.UNFILLED_PLACEHOLDER",
  "severity": "error",
  "summary": "Unfilled migration placeholder",
  "why": "...",
  "fix": "...",
  "nextActions": [],
  "where": { "path": "...", "line": 42 },
  "meta": { "slot": "..." },
  "docsUrl": "https://docs.prisma.io/docs/orm/next/reference/error-reference/MIGRATION.UNFILLED_PLACEHOLDER"
}
```

Codes are `<DOMAIN>.<NAME>`; domains in use: `CLI`, `CONFIG`, `CONTRACT`, `MIGRATION`, `PSL`, `RUNTIME`. Every envelope carries a `docsUrl` pointing at the error reference for its code, and `fix` is the framework's first-party next move — read both before routing. Severity is `error | warn | info` — `migration status` exits 0 when its diagnostics are `warn`, so route on **severity + code together**, not on exit code alone.

**2. Runtime envelope** — thrown by the in-process runtime when executing a query (see `RuntimeErrorEnvelope` in `packages/1-framework/1-core/framework-components/src/execution/runtime-error.ts`):

```ts
{ name: 'RuntimeError', code: 'BUDGET.TIME_EXCEEDED', category: 'BUDGET', severity: 'error', message: '...', details: { ... } }
```

`category` is one of `PLAN | CONTRACT | LINT | BUDGET | RUNTIME` (the prefix of `code`). `details` holds the structured context (`details` is the runtime envelope's equivalent of the CLI envelope's `meta`).

**3. SQL driver errors** — surface as `SqlQueryError` / `SqlConnectionError` (see `packages/2-sql/1-core/errors/`). Fields on `SqlQueryError`: `kind: 'sql_query'`, `sqlState` (Postgres SQLSTATE, e.g. `'23505'`), `constraint`, `table`, `column`, `detail`, `cause`. These are *not* `PN-*` codes — route on `sqlState` and the constraint metadata. SQL driver errors are typically wrapped by middleware before reaching the user, but raw-SQL paths can surface them directly.

### How to ask for the full envelope

If the user only pasted the human summary, ask for `--json` output (machine envelope) or re-run with `-v` (CLI prints the full structured fields). `--json` and `-v` are global flags on every CLI command.

## Routing — script teardown and closed client

These symptoms are not `PN-*` envelopes — route on the message text and chain to `references/runtime.md` § *Running as a script (teardown)*.

| Symptom | Next move |
|---|---|
| `TypeError: db.end is not a function` | The runtime client does not expose `db.end()` — that's the `node-postgres` pool API (`pool.end()`). The right call is `await db.close()`. See `references/runtime.md` § *Running as a script (teardown)*. |
| Script hangs after queries print / process won't exit | On Postgres the façade-owned `pg.Pool` keeps the event loop alive. Call `await db.close()` before the script returns, or `await using db = postgres<Contract>(...)` at the top of a script module (do NOT put `await using` inside a request handler — block-scoped, would close per-request). See `references/runtime.md` § *Running as a script (teardown)*. |
| `Error('Postgres client is closed')` / `Error('SQLite client is closed')` / `Error('Mongo client is closed')` | The client was closed via `db.close()` (terminal state). Remove the early `close()`, reorder so `close()` runs last after all queries, or construct a new `db` if reconnection is intended. See `references/runtime.md` § *Running as a script (teardown)*. |

## Routing — symptom and code → next move

The single source of truth: read the envelope, find the row by `code` (or `meta.code` for wrapped errors), follow the next move.

| Code | Where it surfaces | Next move |
|---|---|---|
| `CONFIG.FILE_NOT_FOUND` / `CLI.CONFIG_NOT_FOUND` *Config file not found* | Most `prisma` commands | Run `prisma orm init`, or pass `--config <path>`. |
| `CONFIG.CONTRACT_MISSING` *Contract configuration missing* | `contract emit`, `db *` | Add `contract: './src/prisma/contract.prisma'` to `defineConfig({...})`. See `references/contract.md`. |
| `CONTRACT.SOURCE_LOAD_FAILED` / `CONTRACT.VALIDATION_FAILED` | `contract emit`, `db *` | The contract source named in `where.path` did not parse (`SOURCE_LOAD_FAILED` carries the PSL diagnostic, e.g. `PSL_UNSUPPORTED_FIELD_TYPE`, in `meta`) or failed structural validation. Fix the source, re-run `pnpm prisma contract emit`. See `references/contract.md`. |
| `CONFIG.DB_CONNECTION_REQUIRED` *Database connection is required* | `db *`, `migration status` | Pass `--db <url>` or set `db.connection` in `prisma.config.ts` (and `DATABASE_URL` in `.env`). |
| `CONFIG.MISSING_EXTENSION_PACKS` | `contract emit` (contract uses `pgvector.Vector(...)` but config does not list the pack) | Add the descriptors named in `meta.missingExtensions` to `extensions` in `prisma.config.ts`. See `references/contract.md`. |
| `MIGRATION.PLANNING_FAILED` | `db init`, `db update` | Inspect `meta.conflicts`. Recovery is per-conflict — chain to `prisma-orm-migrations/references/migrations.md`. |
| `CLI.INIT_*` (`CLI.INIT_MISSING_FLAGS`, `CLI.INIT_INVALID_FLAG_VALUE`, `CLI.INIT_PROBE_FAILED`, …) | `prisma orm init` | Re-run with the flags the envelope names. `CLI.INVALID_ARGUMENTS` *Too many arguments* means a positional project name was passed — `init` takes none. |
| `MIGRATION.UNFILLED_PLACEHOLDER` | `node migrations/app/<dir>/migration.ts` (self-emit) | Edit `migration.ts`, replace the named `placeholder("<slot>")` with a real query closure, self-emit. `db migrate` on such a package does *not* raise this — it applies the empty `ops.json` and fails with `MIGRATION.RUNNER_FAILED`. See `prisma-orm-migrations/references/migrations.md`. |
| `MIGRATION.FILE_MISSING` *migration.ts not found* | Reading a migration package | Restore from version control or scaffold a fresh package with `migration plan`. |
| `MIGRATION.INVALID_DEFAULT_EXPORT` | Loading `migration.ts` | Use `export default class extends Migration { ... }`. See `prisma-orm-migrations/references/migrations.md`. |
| `MIGRATION.DATA_TRANSFORM_CONTRACT_MISMATCH` | Building a data-transform query plan | Pass the same `endContract` reference to both `this.dataTransform(endContract, …)` and the query-builder context. |
| `CONTRACT.MARKER_MISSING` *Database not signed* | `db verify` (exit 4) | DB has no marker yet. Run `prisma db init --db <url>` (baseline empty DB), `db update --db <url>` (apply contract directly), or `db sign` when the schema already matches. |
| `CONTRACT.MARKER_MISMATCH` *Hash mismatch* | `db verify` (exit 4) | Marker disagrees with contract hash. Either migrate forward (`db migrate` / `db update`), or — if the DB is correct after a manual fix-up — `db sign`. See `prisma-orm-migrations/references/migrations.md`. |
| `CONTRACT.TARGET_MISMATCH` | `db verify`, `db sign` | Contract target ≠ config target; align them (see `meta.expected` / `meta.actual`). |
| `CONTRACT.SCHEMA_VERIFICATION_FAILED` | `db verify` (full or `--schema-only`, exit 4) | Live schema does not satisfy the contract; `meta` carries the structured diff. Run `db update` to reconcile, or adjust the contract. |
| `MIGRATION.RUNNER_FAILED` | `db migrate`, `db update`, `db init` | The applied operations did not leave the schema satisfying the destination contract; inspect `meta`, reconcile drift, then re-run. Previously applied migrations are preserved. A package whose `ops.json` is still `[]` (unfilled placeholders) fails here. |
| `CLI.CONSENT_REQUIRED` / `MIGRATION.DESTRUCTIVE_CHANGES` | `db update` — the first when a non-interactive run has destructive ops and no `--confirm`; the second on `--dry-run` | Re-run with `--no-interactive --confirm <database>` (`meta.consentToken` is the database name; `--yes` never grants consent). **Only `db update` has this flow** — `db migrate` does not gate destructive ops. |
| `MIGRATION.HASH_MISMATCH` / `MIGRATION.CONTRACT_SPACE_VIOLATION` / `MIGRATION.CHECK_HASH_MISMATCH` | `db migrate`, `migration status`, `migration check` | A package's stored `migrationHash` disagrees with the recomputed one. Re-emit: `node migrations/app/<dir>/migration.ts`, or restore the package from version control. |
| `MIGRATION.AMBIGUOUS_TARGET` | `migration plan`, `db migrate` | More than one branch tip (concurrent migrations, or a stray package planned from the wrong origin) — `prisma-orm-migrations/references/migration-review.md`. |
| `MIGRATION.PATH_UNREACHABLE` / `MIGRATION.MARKER_MISMATCH` | `db migrate` | No path from the live marker to the target. Follow the `fix` payload (`migration plan --from <from> --to <target>`), or `db migrate --show --db $URL` and `migration list` to audit the graph — see `prisma-orm-migrations/references/migration-review.md`. |
| `MIGRATION.PLAN_ORIGIN_UNKNOWN` / `MIGRATION.HASH_NOT_IN_GRAPH` / `MIGRATION.SNAPSHOT_MISSING` | `migration plan`, `migration ref set` | Origin resolution — `prisma-orm-migrations/references/migration-model.md`. |
| `MIGRATION.NO_INVARIANT_PATH` / `MIGRATION.UNKNOWN_INVARIANT` | `db migrate --to <ref>` | `prisma-orm-migrations/references/migration-review.md`. |
| `MIGRATION.MISSING_INVARIANTS` (info) / `MIGRATION.MARKER_NOT_IN_HISTORY` (warn) / `CONTRACT.UNREADABLE` (warn) | `migration status` `diagnostics[]` (exit 0; CI gates parse `--json`) | Read `severity` *and* `code`. These are the only three status diagnostics; up-to-date, pending, and contract-ahead states are summary-line only. `prisma-orm-migrations/references/migration-review.md`. |
| `BUDGET.ROWS_EXCEEDED` / `BUDGET.TIME_EXCEEDED` | Runtime, when the `budgets` middleware is active | Tune `budgets({ maxRows, maxLatencyMs, ... })` or rewrite the query. See `references/runtime.md`. |
| `LINT.SELECT_STAR` / `LINT.NO_LIMIT` / `LINT.DELETE_WITHOUT_WHERE` / `LINT.UPDATE_WITHOUT_WHERE` / `LINT.READ_ONLY_MUTATION` | Runtime, when the `lints` middleware is active | Fix the query (add a `WHERE` / `LIMIT` / explicit columns), or relax the lint config. See `references/runtime.md`. |
| `PLAN.HASH_MISMATCH` | Runtime, executing a precompiled plan | The contract the plan was built against does not match the runtime contract. Re-emit, rebuild, redeploy. |
| `CONTRACT.MARKER_MISSING` / `CONTRACT.MARKER_MISMATCH` (runtime) | Logged as **warnings** by the runtime's first-use marker check — never thrown, and invisible unless `db.ts` passes a `log` option | Same recovery as the `db verify` rows above. Queries keep running; a stale contract surfaces later as a `SqlQueryError` (e.g. `column … does not exist`). |
| `RUNTIME.TEMPORAL_UNAVAILABLE` | Runtime, first decode of a `Timestamptz` / `DateTime` column on a runtime with no global `Temporal` (stock Node 24) | `import 'temporal-polyfill/global'` before any query, or author the column as `TimestamptzString`. See `references/contract.md`. |
| `RUNTIME.ITERATOR_CONSUMED` | Runtime, iterating an `.all()` result a second time (`for await` after `await` / `toArray()`) | Buffer once into a variable and reuse it. See `references/queries.md`. |
| `RUNTIME.NO_ROWS` | Runtime, `.firstOrThrow()` on an empty result | Expected for a missing row; handle or use `.first()`. |
| `RUNTIME.DECODE_FAILED` | Runtime, e.g. `count()` / integer `sum` outside ±(2^53 − 1) | Switch that call to `countBigInt` / `sumBigInt`. See `references/queries-postgres.md`. |
| `RUNTIME.ABORTED` (`details.phase` = `encode\|decode\|stream\|beforeExecute\|afterExecute\|onRow`) | Runtime, when an `AbortSignal` fires mid-execute | Cancellation, not a bug; surface to the caller. |
| `SqlQueryError` (no `DOMAIN.NAME` code) | Any query surfacing a driver error | Inspect `sqlState` + `constraint` + `table` + `column`. Postgres `23505` = unique violation, `23503` = foreign-key violation, `42501` = permission denied, etc. Fix the data or the schema. |
| TypeScript error mentioning a capability (e.g. `returning()` not on the type, `include` of a many-relation off a many-load) | Authoring-time, before any envelope fires | Capability gates are declared in the **contract** (`capabilities` block, namespaced by target/family), not in `prisma.config.ts`. Route to `references/contract.md` for capability declaration and to `references/queries.md` for which method gates on which capability. Re-emit (`pnpm prisma contract emit`) after enabling. |
| TypeScript error mentioning a missing field/method on `db.orm.<ns>.<Model>` or a stale `Contract` shape | Authoring-time | Re-emit (`pnpm prisma contract emit`); confirm `db.ts` instantiates with `postgres<Contract>(...)` (the single type parameter propagates the contract types), and that model access goes through the namespace coordinate (`db.orm.public.User`, not `db.orm.User`). See `references/runtime.md` and `references/contract.md`. |

If the envelope's `code` is not in this table, follow the envelope's `fix` field literally — it's the framework's first-party next move. If `fix` is empty or unhelpful, escalate via `references/feedback.md`.

## Common Pitfalls

1. **Reading only `summary`, not the rest of the envelope.** `code`, `severity`, `why`, `fix`, `meta`/`details`, and (for CLI errors) `where` are all load-bearing. The agent routes on `code`; the user sees `summary`.
2. **Ignoring `severity`.** `migration status` emits warn-level diagnostics and **exits 0**. An agent that only checks exit code misses every concurrent-migration warning.
3. **Treating drift as something to silence with `db sign`.** `db sign` writes the marker from the current contract hash, but it requires schema verification to pass first. Run `db verify` before reaching for `db sign`.
4. **Re-running `db migrate` after a partial failure without inspecting state.** `db schema --db <url>` shows the live shape; `migration status --db <url> --json` shows where the marker actually is.

## What Prisma Next doesn't do yet

- **Studio / GUI database browser.** No first-party Studio. Workaround: `prisma db schema` for a CLI tree of the live schema, or use a third-party tool (TablePlus, DataGrip, `psql`) against your `DATABASE_URL`. If you need a built-in GUI, file a feature request via `references/feedback.md`.
- **First-class query logger middleware.** No built-in "log every query" middleware ships with the framework. Workaround: write a small custom middleware that wraps each operation (see `references/runtime.md` for middleware composition). If you need a built-in query log, file a feature request via `references/feedback.md`.
- **`EXPLAIN` integration.** No first-class `.explain()` on plans. Workaround: write the EXPLAIN as a raw query (``db.raw.sql`EXPLAIN ANALYZE ...` ``; see `references/queries.md`). If you need first-class EXPLAIN, file a feature request via `references/feedback.md`.
- **Prepared-statement caching as a user-facing surface.** Adapters prepare under the hood for parameterized queries, but you cannot pre-prepare and re-execute a statement by name. Workaround: extract a function that returns the built plan and re-run it via `db.runtime().query(plan)` (see `references/queries.md`). If you need prepared statements as a first-class API, file a feature request via `references/feedback.md`.

## Asking for help when the envelope doesn't route

1. Re-run with `-v` (or `--json` for machine output) to get the full envelope.
2. If the envelope is genuinely uninformative — empty `fix`, missing `meta`, generic `summary` — that's a framework affordance gap; route to `references/feedback.md` with the envelope, the contract source (sanitised), and the reproduction steps.

## Checklist

- [ ] Identified which envelope shape (`CliErrorEnvelope`, `RuntimeErrorEnvelope`, `SqlQueryError`).
- [ ] Read every field — `code`, `severity`, `why`, `fix`, `meta` (or `details`), `where` if present.
- [ ] Routed on `code` to the next move (and chained to the matching authoring skill where the table says so).
- [ ] Re-verified with the relevant CLI command (`db verify`, `migration status --json`, `contract emit`, `db migrate`).
- [ ] Did not confabulate a Studio / EXPLAIN / query-log API — used the documented workaround and routed unmet capability gaps to `references/feedback.md`.
