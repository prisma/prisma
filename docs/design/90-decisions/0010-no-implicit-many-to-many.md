# 0010 — No implicit many-to-many relations

> Draft — unconfirmed. No maintainer has accepted this record yet, so it does not count as a decision.

**Status:** `proposed`. Intended status: `not-yet`.

## The request

Declare a list relation on both sides and let Prisma create the hidden `_AToB` join table, as in Prisma 7.

## The decision

Not in 8.0. A many-to-many relation needs an explicit join model; list navigation on both sides without one is refused.

## What to use instead

Write the join model out. `.include(...)` traverses the relation through it, and nested `create`, `connect` and `disconnect` write the join rows for you. A Prisma 7 schema read as a contract source may still use implicit relations; the reader maps each one to its `_AToB` join table.

## Revisit if

Not recorded. The skill reference sends users who need this to file an issue through its feedback flow, so those issues are the evidence a maintainer weighs when scheduling it.

## Sources

- [scorecard: relations, implicit many-to-many](../../../scorecard/08-relations.md)
- [`prisma-8` skill, contract.md](../../../skills/prisma-8/references/contract.md)
- [`prisma-8` skill, queries.md](../../../skills/prisma-8/references/queries.md)
