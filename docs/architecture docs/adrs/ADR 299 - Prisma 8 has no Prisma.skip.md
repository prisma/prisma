# ADR 299 — Prisma 8 has no `Prisma.skip`

**Status:** Accepted
**Date:** 2026-10-22

---

## Decision

Never. Prisma 8 has no `Prisma.skip`. No document names what to use instead.

## Context

The [scoreboard](../../../scorecard/06-sql-orm-client.md) marks Prisma 7's `Prisma.skip` ❌. The [GA plan](https://github.com/prisma/orm/blob/196fa9e57c53befd65b8f75724aaa660ec480de3/planning/plan.md#never) lists "`Prisma.skip`" under Never. Will Madden decided it in the planning discussion of 2026-09-28 and 2026-09-29, which the GA plan's [decisions](https://github.com/prisma/orm/blob/196fa9e57c53befd65b8f75724aaa660ec480de3/planning/decisions.md) record: "Never. It only made sense for Prisma 7's object-style queries" ([Query features: decided](https://github.com/prisma/orm/blob/196fa9e57c53befd65b8f75724aaa660ec480de3/planning/decisions.md#query-features-decided)).

## Consequences

No revisit-if condition is recorded.
