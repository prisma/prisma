# ADR 303 — Prisma 8 has no read replicas in the core

**Status:** Accepted
**Date:** 2026-10-22

---

## Decision

Never. Prisma 8 has no built-in primary and replica router. Use instead: create a separate `db` client for each data store and call the right one in application code ([`prisma-8` skill, runtime.md](../../../skills/prisma-8/references/runtime.md)).

## Context

The [`prisma-8` skill](../../../skills/prisma-8/references/runtime.md) says Prisma 8 doesn't ship a built-in primary/replica router. The [GA plan](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/plan.md#never) lists "read replicas" under Never. The GA plan's [decisions](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/decisions.md#query-features-decided) list read replicas as "Not planned".

## Consequences

No revisit-if condition is recorded.
