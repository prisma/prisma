# ADR 300 — Prisma 8 has no `omit` under that name

**Status:** Accepted
**Date:** 2026-10-22

---

## Decision

Never under that name. Prisma 8 gets its own way to leave fields out of a result. Its design is done; the GA plan does not say where it is written. Use instead, until it ships: name the fields you want with `select(...)` ([scoreboard](../../../scorecard/06-sql-orm-client.md)).

## Context

The [scoreboard](../../../scorecard/06-sql-orm-client.md) marks Prisma 7's per-query and global `omit` ❌. The [GA plan](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/plan.md#never) lists "`omit` under that name" under Never. Will Madden decided it in the planning discussion of 2026-09-28 and 2026-09-29, which the GA plan's [decisions](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/decisions.md) record: "Never under that name. Prisma 8 gets its own way to leave fields out. Not designed yet" ([Query features: decided](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/decisions.md#query-features-decided)). That row is older than the plan's change of 2026-10-07: "The design of the replacement for `omit` (stream 4, row 3) is done" ([decisions](https://github.com/prisma/orm/blob/196fa9e57c53befd65b8f75724aaa660ec480de3/planning/decisions.md#L107)), and the plan marks the row "Design done (Will, 2026-10-07)" ([plan](https://github.com/prisma/orm/blob/196fa9e57c53befd65b8f75724aaa660ec480de3/planning/plan.md#L90)).

## Consequences

No revisit-if condition is recorded.
