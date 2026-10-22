# ADR 295 — New features do not land on Prisma 7

**Status:** Accepted
**Date:** 2026-10-22
**Builds on:** [ADR 252 — An earlier Prisma version's schema is a contract source](ADR%20252%20-%20An%20earlier%20Prisma%20version's%20schema%20is%20a%20contract%20source.md)

---

## Decision

Prisma 7 receives bug fixes and security updates for eighteen months after `8.0.0` final, and nothing else. Use instead: propose the feature against `main`, for Prisma 8. Move the application to Prisma 8 incrementally; Prisma 8 can read the Prisma 7 schema as its contract source ([ADR 252](ADR%20252%20-%20An%20earlier%20Prisma%20version's%20schema%20is%20a%20contract%20source.md)).

## Context

Contributors open pull requests that add features to Prisma 7, against the `v7` or `7.9.x` branch. The [PR triage guide](../../oss/pr-triage.md#step-2--is-it-in-scope-for-that-line), the [README](../../../README.md) and [SECURITY.md](../../../SECURITY.md) state the maintenance policy. Will Madden, 2026-10-22: Prisma 7 is maintained for 18 months after Prisma 8 GA. The [GA plan](https://github.com/prisma/orm/blob/196fa9e57c53befd65b8f75724aaa660ec480de3/planning/decisions.md#goal) records the same: "Prisma ORM 7 gets bug fixes and security updates for 18 months from the day of GA."

## Consequences

None. The maintenance window ends eighteen months after `8.0.0` final.
