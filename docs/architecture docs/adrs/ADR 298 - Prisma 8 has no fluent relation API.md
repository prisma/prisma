# ADR 298 — Prisma 8 has no fluent relation API

**Status:** Accepted
**Date:** 2026-10-22
**Builds on:** [ADR 296 — Prisma 8 has no `relationLoadStrategy`](ADR%20296%20-%20Prisma%208%20has%20no%20relationLoadStrategy.md)

---

## Decision

Never. Prisma 8 has no fluent relation API such as `findUnique(...).posts()`. Use instead: load the related rows with `.include(...)`, and the database joins them ([ADR 296](ADR%20296%20-%20Prisma%208%20has%20no%20relationLoadStrategy.md); [scoreboard](../../../scorecard/08-relations.md)).

## Context

The [scoreboard](../../../scorecard/08-relations.md) marks Prisma 7's fluent relation traversal, `.posts().author()`, ❌. The [GA plan](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/plan.md#never) lists "the fluent relation API" under Never. Will Madden decided it in the planning discussion of 2026-09-28 and 2026-09-29, which the GA plan's [decisions](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/decisions.md) record: "Never. It belongs to the Prisma 7 query style" ([Query features: decided](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/decisions.md#query-features-decided)).

## Consequences

No revisit-if condition is recorded.
