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
