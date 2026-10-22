# ADR 282 — TypedSQL is not in Prisma 8.0

**Status:** Proposed
**Date:** 2026-10-22
**Builds on:** [ADR 019 — TypedSQL as Separate CLI](ADR%20019%20-%20TypedSQL%20as%20Separate%20CLI.md)

---

## Decision

TypedSQL is not implemented in 8.0. If it is built, [ADR 019](ADR%20019%20-%20TypedSQL%20as%20Separate%20CLI.md) fixes its shape: a separate command-line tool that turns each `.sql` file into a small function returning a plan, not a lane in the core and not a generated client. Use instead: for a query you run often, a prepared statement, `db.prepare(...)`, or a function that returns the built plan; for SQL the builder cannot express, the raw lane (`db.raw.sql`).

## Context

Prisma 7's TypedSQL compiles `.sql` files into typed functions, and users ask for it in Prisma 8. The [scoreboard](../../../scorecard/13-raw-and-typed-sql.md) lists it as not in 8.0, and the [`prisma-8` skill](../../../skills/prisma-8/references/queries.md) sends users who need it to file an issue.

## Consequences

No revisit-if condition is recorded. The issues filed through the skill's feedback flow are the evidence a maintainer weighs when scheduling it.
