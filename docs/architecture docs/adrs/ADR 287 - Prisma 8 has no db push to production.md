# ADR 287 — Prisma 8 has no `db push` to production

**Status:** Accepted
**Date:** 2026-10-22

---

## Decision

Prisma 8 "deliberately does not offer a push-to-prod-without-a-migration surface". `db update` is the quick path for development only. Use instead: in development, `db update`; for production, `migration plan`, review the migration, then `db migrate`.

## Context

Prisma 7's `db push` syncs a database to the schema without a migration, and users ask to do the same to production. The [`prisma-8` skill](../../../skills/prisma-8/references/quickstart.md) states the decision, and its [migrations reference](../../../skills/prisma-8/references/migrations.md) describes the production path. The [Prisma ORM Manifesto 2026](https://www.prisma.io/blog/prisma-orm-manifesto-2026#2-database-tools-must-be-safe-to-delegate) says database tools must show planned changes and require approval for destructive actions.

## Consequences

Every change to a production database is a reviewed migration. No revisit-if condition is recorded.
