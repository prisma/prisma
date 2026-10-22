# ADR 281 — Prisma 8 has no `$queryRaw` method and no `Prisma.sql` helpers

**Status:** Proposed
**Date:** 2026-10-22
**Builds on:** [ADR 247 — Whole-query raw SQL is the fragment mechanism at statement position](ADR%20247%20-%20Whole-query%20raw%20SQL%20is%20the%20fragment%20mechanism%20at%20statement%20position.md), [ADR 259 — Query fragments are functions](ADR%20259%20-%20Query%20fragments%20are%20functions.md)

---

## Decision

Raw SQL is a node in the same query tree as builder queries, not a separate execution surface. Use instead: write a whole query with the raw lane, ``db.raw.sql`SELECT ...`.returnsRow({ ... }).build()`` for rows or `.affectedCount()` for a write, where interpolated values become parameters. Inside a builder query, use `fns.raw` for an expression. Reuse parts of ORM queries with `db.orm.fragment(...)` ([ADR 259](ADR%20259%20-%20Query%20fragments%20are%20functions.md)).

## Context

Users ask for the `$queryRaw` / `$executeRaw` client methods, or the `Prisma.sql`, `Prisma.join`, `Prisma.raw` and `Prisma.empty` fragment helpers, from Prisma 7. [ADR 247](ADR%20247%20-%20Whole-query%20raw%20SQL%20is%20the%20fragment%20mechanism%20at%20statement%20position.md) rejected a `$queryRaw`-style method because it would need its own decoding, checks and telemetry, and raw plans would stop composing with anything else. It also rejected inferring the result shape by parsing the SQL. The [scoreboard](../../../scorecard/13-raw-and-typed-sql.md) lists the four helpers as not in 8.0, and the [`prisma-8` skill](../../../skills/prisma-8/references/queries.md) shows the raw lane.

## Consequences

Raw queries get the same checks and middleware as every other query. [ADR 247](ADR%20247%20-%20Whole-query%20raw%20SQL%20is%20the%20fragment%20mechanism%20at%20statement%20position.md) records no revisit-if condition.
