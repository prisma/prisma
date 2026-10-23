---
changes:
  - id: sql-request-contains-raw-sql
    summary: |
      `SqlExecuteRequest` and `SqlExecutionPlan` (from `@prisma/orm-family-sql`) have a new required field, `containsRawSql: boolean`. It tells the driver whether the statement holds raw SQL, which can change connection state the driver relies on, such as session variables. Code that builds a request for a driver connection's `query` or `execute`, or builds an execution plan by hand, must set it: `true` when the statement can change session state (`SET`, `set_config(...)`, `RESET ALL`, or SQL a user wrote), and `false` for a fixed statement that reads or writes data only. Plans the runtime builds from a query already carry it.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '\.(?:execute|query)\(\s*\{(?![^}]*containsRawSql)[^}]*\bsql\s*:'
        - '\bSqlExecutionPlan\b'
  - id: codec-descriptor-declares-integer
    summary: |
      A codec descriptor (`CodecDescriptorTemplate`, from `@prisma/orm-framework`) can declare `integer: 'number'` or `integer: 'bigint'`: the JavaScript type of its application value, for a codec whose values are integers. The ORM's `having` reads it. A comparand against an aggregate whose output codec declares it must be a safe integer number, and a `'bigint'` codec also takes a `bigint`, with a number passed to it as one. Before, a `having` comparand of type `bigint` compiled, and a number was turned into a bigint, for any codec whose input type was `bigint`. Now both need the declaration. Declare `integer: 'number'` (or, on a descriptor class, `readonly integer = 'number' as const`) on a codec descriptor whose values are integers read as numbers, and `'bigint'` on one read as bigints. Leave it off float, decimal and non-numeric codecs.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '(?<![\s\S])(?![\s\S]*\binteger\s*[:=]\s*[\x27\x22](?:number|bigint))(?=[\s\S]*(?:\bdefine\w*Codecs\b|extends\s+\w*CodecDescriptor\b))[\s\S]*\b(?:int\d*|integer|bigint)\b'
---

# A driver request says whether it holds raw SQL

```ts
// Before
await connection.execute({ sql: 'SELECT set_config($1, $2, false)', params: ['role', role] });
await connection.execute({ sql: 'RESET ALL' });

// After
await connection.execute({
  containsRawSql: true,
  sql: 'SELECT set_config($1, $2, false)',
  params: ['role', role],
});
await connection.execute({ containsRawSql: true, sql: 'RESET ALL' });
```

TypeScript reports every request or plan object that lacks the field. Pass `true` for any statement that sets, changes or resets session state, and `false` otherwise. A MySQL driver discards a pooled connection after a statement marked `true`, so marking a plain read `true` is safe but costs a reconnect.
