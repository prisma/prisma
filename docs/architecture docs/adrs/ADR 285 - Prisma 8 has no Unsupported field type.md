# ADR 285 — Prisma 8 has no `Unsupported("...")` field type

**Status:** Proposed
**Date:** 2026-10-22
**Builds on:** [ADR 273 — A column of a type no data type claims is a raw column](ADR%20273%20-%20A%20column%20of%20a%20type%20no%20data%20type%20claims%20is%20a%20raw%20column.md), [ADR 252 — An earlier Prisma version's schema is a contract source](ADR%20252%20-%20An%20earlier%20Prisma%20version's%20schema%20is%20a%20contract%20source.md)

---

## Decision

`Unsupported("...")` is not a Prisma 8 type, and `contract emit` refuses it. A column whose type no data type claims is a raw column instead ([ADR 273](ADR%20273%20-%20A%20column%20of%20a%20type%20no%20data%20type%20claims%20is%20a%20raw%20column.md)). Use instead: write the column as ``Raw(sql`ltree`)``. A Prisma 7 schema read as a contract source still accepts `Unsupported("...")` and reads each such field as a raw column ([ADR 252](ADR%20252%20-%20An%20earlier%20Prisma%20version's%20schema%20is%20a%20contract%20source.md)).

## Context

Prisma 7 declares a column of a type Prisma does not model with `Unsupported("ltree")`, and users write the same in Prisma 8. The [scoreboard](../../../scorecard/03-psl-schema-language.md) lists it as not in 8.0.

## Consequences

A raw column keeps its type exactly as the database prints it, values pass through untyped, and migrations and `db verify` handle it. [ADR 273](ADR%20273%20-%20A%20column%20of%20a%20type%20no%20data%20type%20claims%20is%20a%20raw%20column.md) records no revisit-if condition.
