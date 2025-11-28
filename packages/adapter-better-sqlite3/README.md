# Prisma driver adapter for better-sqlite3

Prisma driver adapter for `better-sqlite3`.

## URL Parameters

The adapter supports the following URL parameters:

- `busy_timeout`: Sets the busy timeout in milliseconds. Useful for compatibility with tools like [Litestream](https://litestream.io/tips/#busy-timeout) that may lock the database during replication.
- `connection_limit`: Supported for compatibility (better-sqlite3 is single-threaded by nature).

### Example

```typescript
const adapter = new PrismaBetterSqlite3({
  url: './dev.db?busy_timeout=5000'
})
```

This sets a 5-second busy timeout, allowing operations to wait up to 5 seconds if the database is locked by another process (e.g., Litestream replication).
