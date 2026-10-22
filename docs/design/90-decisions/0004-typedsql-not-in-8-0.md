# 0004 — TypedSQL is not in 8.0

> **Draft — for maintainer acceptance.**

**Status:** `not-yet`

## The request

Compile `.sql` files into typed functions, as Prisma 7's TypedSQL does.

## The decision

TypedSQL is not implemented in 8.0. If it is built, ADR 019 fixes its shape: a separate command-line tool that turns each `.sql` file into a small function returning a plan, not a lane in the core and not a generated client.

## What to use instead

For a query you run often, use a prepared statement, `db.prepare(...)`, or a function that returns the built plan. For SQL the builder cannot express, use the raw lane (`db.raw.sql`).

## Revisit if

Not recorded. The skill reference sends users who need this to file an issue through its feedback flow, so those issues are the evidence a maintainer weighs when scheduling it.

## Sources

- [scorecard: TypedSQL](../../../scorecard/13-raw-and-typed-sql.md)
- [ADR 019](../../architecture%20docs/adrs/ADR%20019%20-%20TypedSQL%20as%20Separate%20CLI.md)
- [`prisma-8` skill, queries.md](../../../skills/prisma-8/references/queries.md)
