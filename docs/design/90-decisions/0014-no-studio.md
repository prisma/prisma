# 0014 — No Prisma Studio

> **Draft — for maintainer acceptance.**

**Status:** `not-yet`

## The request

Ship Prisma Studio, a graphical database browser, with Prisma 8.

## The decision

Not in 8.0.

## What to use instead

`prisma db schema` prints the live schema as a tree. Use a third-party tool such as TablePlus, DataGrip or `psql` against the same database URL.

## Revisit if

Not recorded. The skill reference sends users who need this to file an issue through its feedback flow, so those issues are the evidence a maintainer weighs when scheduling it.

## Sources

- [scorecard: CLI commands, `prisma studio`](../../../scorecard/17-cli-commands.md)
- [`prisma-8` skill, debug.md](../../../skills/prisma-8/references/debug.md)
- [`prisma-8` skill, quickstart.md](../../../skills/prisma-8/references/quickstart.md)
