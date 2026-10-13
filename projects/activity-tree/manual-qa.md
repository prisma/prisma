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
