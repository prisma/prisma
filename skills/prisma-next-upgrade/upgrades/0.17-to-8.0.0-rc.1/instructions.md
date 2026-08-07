---
from: "0.17"
to: "8.0.0-rc.1"
changes:
  - id: aggregate-results-carry-their-target-s-codec
    summary: |
      Aggregates read back through the codec their target declares for the result, so their
      application types change. `count()` is a `bigint` on both targets — a count is a cardinality
      and is not capped at 2^53. On PostgreSQL, `sum` over `int2`/`int4` widens to `int8` and reads
      as a `bigint`, while `sum(int8)` and `avg` over any integer are `numeric` and read as decimal
      **strings**; `min`/`max` keep the column's own type, except over `varchar`, where PostgreSQL
      returns `text`. On SQLite, `sum` over an integer column is a `bigint` and `avg` is always a
      `number` (real). The two targets genuinely diverge on `avg` — a portable query must handle
      both, and there is no shim that flattens them. Include reducers
      (`.include('posts', (p) => p.count())`) decode the same way, so an included count is a
      `bigint` too, and an empty relation reads `0n` rather than `0`. Comparisons are where this
      bites quietly: `count === 2` is false where `count` is `2n`, and `JSON.stringify` throws on a
      bigint. Sweep for `toBe(<number>)` / `=== <number>` / arithmetic against an aggregate result
      and switch to `2n` or the decimal string, and render bigints explicitly (`String(value)`)
      wherever you serialise. `having(...)` operands are the exception and stay numbers — they are
      compared inside SQL and never cross a codec. Regenerate your contracts
      (`prisma-next contract emit`): the emitted `contract.d.ts` gains an `AggregateTypes` block
      that types every aggregate per operation and input codec, and the ORM and SQL builder both
      resolve their result types from it — against a contract emitted before 8.0.0-rc.1 an aggregate
      resolves to `never` in the ORM and to `unknown` in the SQL builder.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - "aggregate("
        - ".count()"
        - "groupBy("
      anyMatch: true
  - id: runtime-query-execute-hard-cut
    summary: |
      Runtime row execution now uses `query()`, prepared rows use `queryPrepared()`, and `execute()` returns statement statistics instead of rows. Classify each call by the result its caller consumes rather than replacing every `execute` token: move row plans to `query`, move `PreparedStatement.execute(runtime, params)` to `runtime.queryPrepared(statement, params)`, and keep non-returning writes on `execute` while reading `affectedRows` when needed. The Mongo facade keeps `db.query` as its static builder and removes facade `db.execute`; execute a built row plan through `(await db.runtime()).query(plan)`.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - ".execute("
        - "executePrepared("
        - "AfterExecuteResult"
        - "intercept("
        - "spyOn("
      anyMatch: true
---

# 0.17 → 8.0.0-rc.1 — User upgrade instructions

## `aggregate-results-carry-their-target-s-codec`

An aggregate's result is a value the database computes, and 8.0.0-rc.1 reads it back through the codec its target declares for that result rather than through whatever the driver happened to hand over. What each aggregate returns is now the target's answer, stated in the contract and honoured by the runtime:

| Target | Aggregate | Reads as |
| --- | --- | --- |
| PostgreSQL | `count()` (with or without an argument) | `bigint` |
| PostgreSQL | `sum` over `int2` / `int4` | `bigint` (the sum widens to `int8`) |
| PostgreSQL | `sum` over `int8`, `avg` over any integer | decimal `string` (the result is `numeric`) |
| PostgreSQL | `sum` / `avg` over `float4` / `float8` | `number` |
| PostgreSQL | `min` / `max` | the column's own type — except over `varchar`, which returns `text` |
| SQLite | `count()` | `bigint` |
| SQLite | `sum` over an integer column | `bigint` |
| SQLite | `avg` over anything | `number` (SQLite's `avg` is always real) |
| SQLite | `min` / `max` | the column's own type |

The targets diverge on `avg`, and deliberately: PostgreSQL computes it as `numeric`, SQLite as a float. A query written against both handles both.

Include reducers follow the same rules — `.include('posts', (posts) => posts.count())` yields a `bigint`, and a parent with no related rows reads `0n` where it read `0`.

Two failure modes are worth sweeping for, because neither announces itself:

- **Equality against a number.** `row.count === 2` is `false` when `row.count` is `2n`, and `expect(count).toBe(2)` fails the same way. Change the literal (`2n`), or compare through `Number(...)` where the magnitude is known to be small.
- **Serialisation.** `JSON.stringify` throws `TypeError: Do not know how to serialize a BigInt`. Render explicitly — `String(count)`, or a replacer that maps bigints to strings.

Arithmetic mixing a bigint with a number also throws (`2n + 1` is a `TypeError`); convert one side deliberately.

`having(...)` is the one place that does not move. A HAVING operand is compared inside SQL against the aggregate the database is computing, so it never crosses a codec: `having.count().gte(2)` keeps the plain number it always took. Only the aggregate's *result* — the value that reaches your code — carries its target's type.

Finally, regenerate your contracts:

```bash
prisma-next contract emit
```

The emitted `contract.d.ts` gains an `AggregateTypes` block — the settled result identity per operation and per input codec — and both the ORM client and the SQL builder resolve their aggregate result types from it. Against a contract emitted before 8.0.0-rc.1 the block is absent, so an aggregate resolves to `never` in the ORM and to `unknown` in the SQL builder: a type error at the call site in the first case, an untyped value in the second, rather than a wrong runtime value in either.

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

If the application defines runtime middleware, update it to respect the operation discriminant. Query interception returns `{ operation: 'query', rows }`, execute interception returns `{ operation: 'execute', stats }`, and completion handlers check `result.operation` before reading the operation-specific fields. Row-oriented middleware must ignore execute operations rather than deriving statistics from rows.

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
