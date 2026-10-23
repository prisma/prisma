---
changes:
  - id: sql-request-contains-raw-sql
    summary: |
      `SqlExecuteRequest` (from `@prisma/orm-family-sql`) has a new required field, `containsRawSql: boolean`. It tells the driver whether the statement may change session state the driver relies on, such as session variables; a driver may ignore it. Code that builds a request for a driver or connection's `query` or `execute` must set it: `true` when the statement can change session state (`SET`, `set_config(...)`, `RESET ALL`, or SQL a user wrote), and `false` for a fixed statement that reads or writes data only. The runtime sets it for every query it runs, from the query's AST.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '\.(?:execute|query)\(\s*\{(?![^}]*containsRawSql)[^}]*\bsql\s*:'
  - id: codec-descriptor-declares-integer
    summary: |
      A codec descriptor (`CodecDescriptorTemplate`, from `@prisma/orm-framework`) can declare `integerRepresentation: 'number'` or `integerRepresentation: 'bigint'`: the JavaScript type of its application value, for a codec whose values are integers. The ORM's `having` reads it. A comparand against an aggregate whose output codec declares it must be a safe integer number, and a `'bigint'` codec also takes a `bigint`, with a number passed to it as one. Before, a `having` comparand of type `bigint` compiled, and a number was turned into a bigint, for any codec whose input type was `bigint`. Now both need the declaration. Declare `integerRepresentation: 'number'` (or, on a descriptor class, `readonly integerRepresentation = 'number' as const`) on a codec descriptor whose values are integers read as numbers, and `'bigint'` on one read as bigints. Leave it off float, decimal and non-numeric codecs. Check each codec descriptor in a matched file: a file can declare it on one descriptor and miss another.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '(?<![\s\S])(?=[\s\S]*(?:\bdefine\w*Codecs\b|extends\s+\w*CodecDescriptor\b))[\s\S]*\b(?:int\d*|integer|bigint)\b'
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
