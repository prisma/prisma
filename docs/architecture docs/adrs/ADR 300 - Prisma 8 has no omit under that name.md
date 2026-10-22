# ADR 300 — Prisma 8 has no `omit` under that name

**Status:** Accepted
**Date:** 2026-10-22

---

## Decision

Never under that name. Prisma 8 gets its own way to leave fields out of a result, and that way is not designed yet. Use instead, today: name the fields you want with `select(...)` ([scoreboard](../../../scorecard/06-sql-orm-client.md)).

## Context

The [scoreboard](../../../scorecard/06-sql-orm-client.md) marks Prisma 7's per-query and global `omit` ❌. The [GA plan](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/plan.md#never) lists "`omit` under that name" under Never. Will Madden decided it in the planning discussion of 2026-09-28 and 2026-09-29, which the GA plan's [decisions](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/decisions.md) record: "Never under that name. Prisma 8 gets its own way to leave fields out. Not designed yet" ([Query features: decided](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/decisions.md#query-features-decided)). Designing it is a task before GA ([Tasks to decide or fix before GA](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/decisions.md#tasks-to-decide-or-fix-before-ga)).

## Consequences

No revisit-if condition is recorded.
