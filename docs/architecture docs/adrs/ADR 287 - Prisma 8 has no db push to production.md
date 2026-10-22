# ADR 287 — Prisma 8 has no `db push` to production

**Status:** Accepted
**Date:** 2026-10-22

---

## Decision

Prisma 8 "deliberately does not offer a push-to-prod-without-a-migration surface". `db update` is the quick path for development only. Use instead: in development, `db update`; for production, `migration plan`, review the migration, then `db migrate`.

## Context

Prisma 7's `db push` syncs a database to the schema without a migration. The [`prisma-8` skill](../../../skills/prisma-8/references/quickstart.md) states the decision, and its [migrations reference](../../../skills/prisma-8/references/migrations.md) describes the production path. The skill gives no reason. The decision matches the manifesto's rule for database tools: "It shows what it will do before it does it, checks its own work afterwards, and asks before it destroys anything." ([principle 2](https://www.prisma.io/blog/prisma-orm-manifesto-2026#2-database-tools-must-be-safe-to-delegate))

## Consequences

Every change to a production database is a reviewed migration. No revisit-if condition is recorded.
