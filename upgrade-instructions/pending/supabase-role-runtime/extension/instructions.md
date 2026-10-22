---
changes:
  - id: supabase-for-role-replaces-with-role-methods
    summary: |
      `SupabaseRuntime` no longer has `queryWithRole`, `executeWithRole`, `preparedQueryWithRole` or `preparedExecuteWithRole`, and `SupabaseRuntimeImpl` no longer has `roleActivitySource`. Call `runtime.forRole(binding)` once and use its members: `runtime.queryWithRole(plan, binding, options)` becomes `runtime.forRole(binding).query(plan, options)`, `executeWithRole` becomes `forRole(binding).execute`, a prepared statement runs on the role with `statement.query(runtime.forRole(binding), params)` or `statement.execute(runtime.forRole(binding), params)`, and the role's activity source is the `activitySource` member of `forRole(binding)`. The detection matches files that call one of the removed methods.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '\.(?:queryWithRole|executeWithRole|preparedQueryWithRole|preparedExecuteWithRole|roleActivitySource)\('
  - id: raw-connection-obeys-close
    summary: |
      `SqlRuntimeBase.acquireRawConnection()` now goes through the runtime's entry check: after `close()` or the new `drain()` has started, it rejects with `DRIVER.NOT_CONNECTED` "Runtime is closed", and `close()` waits until the connection is released or destroyed. A subclass must release or destroy every raw connection it acquires. When it acquires one for an activity admitted before the close, pass `{ activityParent }`, as the runtime's own statements do, so the connection is admitted. A subclass that shares its driver with another runtime calls `drain()` on each, then `close()` on one of them, so the driver closes once. The detection matches files that call `acquireRawConnection`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '(?<![\w$])acquireRawConnection\('
  - id: supabase-pg-takes-a-pool
    summary: |
      The `pg` option of `supabase()` takes a `pg.Pool` only. A `pg.Client` is a type error and fails at `supabase()` with `SUPABASE.CONFIG_INVALID`. Replace `pg: new Client(...)` with `pg: new Pool(...)` built from the same settings, or pass `url`. The detection matches every `supabase()` call that passes `pg`; leave a call that already passes a `pg.Pool` as it is.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '(?<![\w$.])supabase(?:<[^>]*>)?\(\s*\{(?:[^{}]|\{[^{}]*\})*?(?<![\w$.])pg\s*[:,}]'
---

# Supabase runs every role operation through one object

`SupabaseRuntime.forRole(binding)` returns the runtime operations under one role: `query`, `execute`, the prepared-statement operations, `transaction` and `connection`.

```ts
// Before
const rows = await runtime.queryWithRole(plan, { role: 'anon' }).toArray();

// After
const rows = await runtime.forRole({ role: 'anon' }).query(plan).toArray();
```

A raw connection now counts as runtime work until it is released:

```ts
const connection = await this.acquireRawConnection({ activityParent });
try {
  await connection.execute({ sql: 'SELECT 1' });
} finally {
  await connection.release();
}
```
