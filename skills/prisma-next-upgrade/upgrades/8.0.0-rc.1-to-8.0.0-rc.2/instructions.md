---
from: "8.0.0-rc.1"
to: "8.0.0-rc.2"
changes:
  - id: runtime-query-execute-hard-cut
    summary: |
      Runtime row execution now uses `query()`, prepared rows use `queryPrepared()`, and `execute()` returns statement statistics instead of rows. Classify each call by the result its caller consumes rather than replacing every `execute` token: move row plans to `query`, move `PreparedStatement.execute(runtime, params)` to `runtime.queryPrepared(statement, params)`, and keep non-returning writes on `execute` while reading `affectedRows` when needed. The Mongo facade keeps `db.query` as its static builder and removes facade `db.execute`; execute a built row plan through `(await db.runtime()).query(plan)`.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - ".execute("
        - "executePrepared("
        - "spyOn("
      anyMatch: true
---

# 8.0.0-rc.1 → 8.0.0-rc.2 — User upgrade instructions

<!--
PR #29910: `changes: []`. The example changes repair test instrumentation and fixture/runtime isolation after the driver SPI split; they require no user API, contract, configuration, generated-artifact, or source translation.
-->

## `runtime-query-execute-hard-cut`

Runtime operations now state whether the caller expects rows or statement statistics. Do not apply a global `execute` → `query` replacement: an insert, update, or delete that does not return rows belongs on `execute`, while a select, a returning write, a Mongo command-result plan, or any other plan whose result is iterated, awaited as an array, indexed, decoded, or otherwise read belongs on `query`.

Translate public calls by consumed result:

| Before 0.18 | 0.18 translation |
| --- | --- |
| `await runtime.execute(rowPlan)` | `await runtime.query(rowPlan)` |
| `runtime.execute(rowPlan).toArray()` | `runtime.query(rowPlan).toArray()` |
| `await prepared.execute(runtime, params)` | `await runtime.queryPrepared(prepared, params)` |
| `await runtime.execute(nonReturningWrite)` with ignored rows | `await runtime.execute(nonReturningWrite)` and ignore the returned statistics |
| A count or status derived from rows returned by a non-returning write | `const stats = await runtime.execute(writePlan)` and use `stats.affectedRows` |

Apply the same classification to connection and transaction scopes. `query()` and `queryPrepared()` remain lazy row results, so consume them inside the scope when their connection or transaction must remain valid. `execute()` is eager and resolves to `{ affectedRows: number }`; it does not return an iterable, and `affectedRows` must not be synthesized from a row array's length.

Tests that observe whether a row query reached the SQL driver must spy on `driver.query`, not `driver.execute`. Keep the existing hit/miss comparison intact; only move the observation to the row path. Statistics tests continue to observe `driver.execute`.

Mongo has an additional naming collision. `db.query` remains the static query-builder surface, so there is no row-execution method named `query` directly on the facade and the old row-returning `db.execute(plan)` facade method is removed. Build with `db.query`, obtain the connected runtime, then query the plan:

```ts
const plan = db.query.from('products').match(filter).build();
const rows = await (await db.runtime()).query(plan);
```

Fully consume the returned row result when execution itself is required, even if the rows are otherwise ignored:

```ts
await (await db.runtime()).query(plan).toArray();
```

Search broadly for `.execute(` and retired prepared execution, then inspect each candidate's plan and downstream use. Rows being iterated, indexed, decoded, compared as arrays, or passed to a row mapper identify `query`; reads of `affectedRows` or ignored results from non-returning DML identify `execute`. Leave unrelated APIs such as migration runners alone.
