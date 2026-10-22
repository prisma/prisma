# ADR 284 — Prisma 8 has no `dbgenerated(...)`

**Status:** Proposed
**Date:** 2026-10-22
**Builds on:** [ADR 268 — Raw SQL is a value of the data type sql-expression](ADR%20268%20-%20Raw%20SQL%20is%20a%20value%20of%20the%20data%20type%20sql-expression.md)

---

## Decision

Every place in a schema that holds raw SQL takes a `sql` tagged literal, and only that. A `dbgenerated(...)` call is refused with an error that names the replacement. Use instead: `` @default(sql`now() - interval '1 day'`) ``. The Prisma 7 schema reader still reads `dbgenerated(...)` from a Prisma 7 schema.

## Context

Users ask to keep `@default(dbgenerated("..."))` from Prisma 7 for a database default written as raw SQL. [ADR 268](ADR%20268%20-%20Raw%20SQL%20is%20a%20value%20of%20the%20data%20type%20sql-expression.md) rejected accepting plain strings beside `sql` literals: two ways to write the same value, with no benefit. The scoreboard lists the change for the [schema language](../../../scorecard/03-psl-schema-language.md) and [migrations](../../../scorecard/15-migrations.md).

## Consequences

[ADR 268](ADR%20268%20-%20Raw%20SQL%20is%20a%20value%20of%20the%20data%20type%20sql-expression.md) records a revisit-if condition for a related choice only: a public way to build a `sql` value from a computed string is reconsidered "when a user needs SQL text generated at run time". None is recorded for `dbgenerated` itself.
