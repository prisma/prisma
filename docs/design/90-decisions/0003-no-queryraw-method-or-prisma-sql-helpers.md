# 0003 — No `$queryRaw` method or `Prisma.sql` helpers

> Draft — unconfirmed. No maintainer has accepted this record yet, so it does not count as a decision.

**Status:** `proposed`. Intended status: `never`.

## The request

Add a `$queryRaw` / `$executeRaw` client method, or the `Prisma.sql`, `Prisma.join`, `Prisma.raw` and `Prisma.empty` fragment helpers from Prisma 7.

## The decision

Raw SQL is a node in the same query tree as builder queries, not a separate execution surface. ADR 247 rejected a `$queryRaw`-style client method because it would need its own decoding, checks and telemetry, and raw plans would stop composing with anything else. It also rejected inferring the result shape by parsing the SQL. The scorecard lists the four `Prisma.*` fragment helpers as not in 8.0.

## What to use instead

Write a whole query with the raw lane: ``db.raw.sql`SELECT ...`.returnsRow({ ... }).build()`` for rows, or `.affectedCount()` for a write. Values interpolated into the template become parameters. Inside a builder query, use `fns.raw` for an expression. Reuse parts of ORM queries with `db.orm.fragment(...)` (ADR 259).

## Revisit if

The ADR records no condition.

## Sources

- [ADR 247](../../architecture%20docs/adrs/ADR%20247%20-%20Whole-query%20raw%20SQL%20is%20the%20fragment%20mechanism%20at%20statement%20position.md)
- [ADR 259](../../architecture%20docs/adrs/ADR%20259%20-%20Query%20fragments%20are%20functions.md)
- [scorecard: raw and typed SQL](../../../scorecard/13-raw-and-typed-sql.md)
- [`prisma-8` skill, queries.md](../../../skills/prisma-8/references/queries.md)
