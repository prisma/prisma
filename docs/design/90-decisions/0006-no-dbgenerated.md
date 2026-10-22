# 0006 — No `dbgenerated(...)`

> **Draft — for maintainer acceptance.**

**Status:** `never`

## The request

Keep `@default(dbgenerated("..."))` for a database default written as raw SQL.

## The decision

Every place in a schema that holds raw SQL takes a `sql` tagged literal, and only that. ADR 268 rejected accepting plain strings beside `sql` literals: two ways to write the same value, with no benefit. A `dbgenerated(...)` call is refused with an error that names the replacement.

## What to use instead

`` @default(sql`now() - interval '1 day'`) ``. The Prisma 7 schema reader still reads `dbgenerated(...)` from a Prisma 7 schema.

## Revisit if

ADR 268 records one condition for a related choice: a public way to build a `sql` value from a computed string is reconsidered "when a user needs SQL text generated at run time". None for `dbgenerated` itself.

## Sources

- [ADR 268](../../architecture%20docs/adrs/ADR%20268%20-%20Raw%20SQL%20is%20a%20value%20of%20the%20data%20type%20sql-expression.md)
- [scorecard: PSL schema language, `dbgenerated`](../../../scorecard/03-psl-schema-language.md)
- [scorecard: migrations, `dbgenerated(...)` defaults](../../../scorecard/15-migrations.md)
