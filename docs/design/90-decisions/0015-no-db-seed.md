# 0015 — No `db seed` command

> Draft — unconfirmed. No maintainer has accepted this record yet, so it does not count as a decision.

**Status:** `proposed`. Intended status: `not-yet`.

## The request

Run seed data with `prisma db seed`, as in Prisma 7.

## The decision

Not in 8.0.

## What to use instead

A TypeScript script that imports your `db` client and runs the setup queries, started from a `package.json` script.

## Revisit if

Not recorded. The skill reference sends users who need this to file an issue through its feedback flow, so those issues are the evidence a maintainer weighs when scheduling it.

## Sources

- [scorecard: migrations, `db seed`](../../../scorecard/15-migrations.md)
- [scorecard: CLI commands, `db seed`](../../../scorecard/17-cli-commands.md)
- [`prisma-8` skill, migrations.md](../../../skills/prisma-8/references/migrations.md)
