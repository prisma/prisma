# ADR 288 — Prisma 8 has no implicit many-to-many relations

**Status:** Accepted
**Date:** 2026-10-22

---

## Decision

A many-to-many relation needs an explicit join model; list navigation on both sides without one is refused. Use instead: write the join model out. `.include(...)` traverses the relation through it, and nested `create`, `connect` and `disconnect` write the join rows for you. A Prisma 7 schema read as a contract source may still use implicit relations; the reader maps each one to its `_AToB` join table.

## Context

Prisma 7 lets a schema declare a list relation on both sides and creates the hidden `_AToB` join table. The [scoreboard](../../../scorecard/08-relations.md) marks implicit many-to-many ❌, which its [legend](../../../scorecard.md) defines as "Not in 8.0 — deliberately absent from Prisma 8", and the `prisma-8` skill's [contract](../../../skills/prisma-8/references/contract.md) and [queries](../../../skills/prisma-8/references/queries.md) references send users who need it to file an issue.

## Consequences

No revisit-if condition is recorded.
