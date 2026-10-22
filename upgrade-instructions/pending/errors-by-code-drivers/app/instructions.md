---
changes:
  - id: close-ends-the-client-not-your-pool
    summary: |
      `close()` on a Postgres or Supabase client built on a pool or `pg.Client` you passed in now always closes the Prisma client: later queries on it fail. Your pool or `pg.Client` stays open, as before; end it yourself. Create a new Prisma client if you need one after `close()`.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      matches:
        - '(?:postgres|supabase)\(\s*\{[\s\S]*?\b(?:pg|binding|pool|client)\s*[:,}]'
  - id: sqlite-open-failure-is-a-connection-error
    summary: |
      A SQLite database file that cannot be opened (a missing directory, or a file that is not a database) is now reported as a connection error, not a query error. Code that caught a query error to handle a bad database path catches the connection error instead.
---

# Postgres and SQLite errors are classified by code

## `close()` with a pool or client you passed in

When you pass your own `pg.Pool` or `pg.Client` to `postgres()` or `supabase()`, calling `close()` on the Prisma client now closes the Prisma client. Before, it left the client open, and queries after `close()` still ran.

Your pool or client is still yours: Prisma never ends it. If your code ran queries through the Prisma client after `close()`, create a new Prisma client instead:

```ts
// Before: queries on db still ran after close()
await db.close();

// After: create a new Prisma client on the same pool
await db.close();
const db2 = postgres({ contract, pg: pool });
```

A `pg.Client` you pass in may be connected or not: Prisma connects it if it has not started connecting. If its connection is lost, create a new `pg.Client`; a pg client cannot reconnect.

## SQLite open failures

When the SQLite database file cannot be opened, the error is now a connection error. The CLI reports it as `DRIVER.CONNECTION_FAILED`.
