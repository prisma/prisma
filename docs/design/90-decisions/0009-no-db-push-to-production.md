# 0009 — No `db push` to production

> **Draft — for maintainer acceptance.**

**Status:** `never`

## The request

Sync a production database to the schema without a migration, as Prisma 7's `db push` does.

## The decision

Prisma 8 "deliberately does not offer a push-to-prod-without-a-migration surface". `db update` is the quick path for development only.

## What to use instead

In development, `db update`. For production, `migration plan`, review the migration, then `db migrate`.

## Revisit if

The source records no condition.

## Sources

- [`prisma-8` skill, quickstart.md](../../../skills/prisma-8/references/quickstart.md)
- [`prisma-8` skill, migrations.md](../../../skills/prisma-8/references/migrations.md)
