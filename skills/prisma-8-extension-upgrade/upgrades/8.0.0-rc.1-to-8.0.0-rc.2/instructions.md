---
from: "8.0.0-rc.1"
to: "8.0.0-rc.2"
changes:
  - id: runtime-query-execute-hard-cut
    summary: |
      Runtime and scope implementations now expose `query()` for rows, `queryPrepared()` for prepared rows, and statistics-returning `execute()` for non-returning statements. Classify callers and helpers by consumed result; do not globally rename `execute`. Keep separate row/statistics fake queues and spies, and never derive `affectedRows` from row length. The Mongo facade keeps its static `db.query` builder and removes row `db.execute`; run built row plans through `(await db.runtime()).query(plan)` without adding an alias.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - "RuntimeExecutor"
        - "RuntimeQueryable"
        - "executePrepared("
        - ".execute("
      anyMatch: true
---

# 8.0.0-rc.1 → 8.0.0-rc.2 — Extension-author upgrade instructions

<!--
PR #29910: `changes: []`. Binding internal mutation-reload filters and repairing Supabase runtime coverage after the driver SPI split require no downstream extension source translation.

PR #29920: `changes: []`. Adds prepared-statement test coverage to the Supabase runtime suite (test-fixture codec registration only) and fixes a postgres direct-driver transaction defect; neither requires downstream extension source translation. The SPI split itself is recorded as `driver-spi-splits-query-and-execute` in the 0.17-to-8.0.0-rc.1 transition.
-->

## `runtime-query-execute-hard-cut`

The runtime SPI now separates row streams from statement statistics. This is a semantic classification, not a rename: inspect what each caller consumes and what each implementation returns before editing it.

A runtime, connection, transaction, role-bound scope, ORM runtime adapter, or test double that implements the execution contract must provide the applicable operations with these meanings:

```ts
interface RuntimeExecutor {
  query<Row>(plan: QueryPlan<Row>, options?: RuntimeExecuteOptions): AsyncIterableResult<Row>;
  execute(plan: QueryPlan, options?: RuntimeExecuteOptions): Promise<RuntimeStatementStats>;
}

interface PreparedRuntimeExecutor extends RuntimeExecutor {
  queryPrepared<Params, Row>(statement: PreparedStatement<Params, Row>, params: Params, options?: RuntimeExecuteOptions): AsyncIterableResult<Row>;
}
```

Use the concrete family plan and statistics types required by your extension. Route row-returning plans to the bound driver's or runtime's `query` path, route prepared rows to `queryPrepared`, and route non-returning statements to `execute`. Preserve the bound scope: connection wrappers call the connection operations, transaction wrappers call the transaction operations, and role-bound wrappers use the same acquired session for both paths. Preserve row-result laziness and cleanup, while statistics execution is eager and returns the exact `{ affectedRows }` object supplied by the lower layer.

Translate prepared row callers from `statement.execute(target, params)` or any retired `executePrepared` helper to `target.queryPrepared(statement, params)`. Rename private helpers whose only purpose is returning rows when their old `execute` name would conceal the distinction, but do not add compatibility aliases.

Split fakes and observations so the test can detect a wrong route. A useful fake has a row-result queue consumed only by `query`, a statistics queue consumed only by `execute`, distinct spies or an explicit `operation` field, and whole-shape assertions for `{ affectedRows }`. Delete fakes that model `execute` as an async row generator or `query` as a buffered `{ rows, rowCount }` result. If existing code counted a non-returning write's result rows, await `execute` and read `stats.affectedRows`; never substitute row-array length.

Apply the public Mongo facade migration separately from the runtime SPI. `db.query` remains the static builder, so remove any facade row `execute` compatibility member and do not introduce `queryRows`, `run`, or another alias. Facade consumers build the plan with `db.query` and execute rows through the connected runtime:

```ts
const plan = db.query.from('events').build();
const rows = await (await db.runtime()).query(plan);
```

Search for `.execute(`, `executePrepared`, implementations of `RuntimeExecutor` or family runtime scopes, and fakes returning rows. Classify each match from its plan and consumed result. Leave genuine statistics calls, lower-level migration-runner APIs, and unrelated domain methods named `execute` unchanged.
