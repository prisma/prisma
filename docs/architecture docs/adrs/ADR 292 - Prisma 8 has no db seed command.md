# ADR 292 — Prisma 8 has no `db seed` command

**Status:** Proposed
**Date:** 2026-10-22

---

## Decision

Not in 8.0. Use instead: a TypeScript script that imports your `db` client and runs the setup queries, started from a `package.json` script.

## Context

Users ask to run seed data with `prisma db seed`, as in Prisma 7. The scoreboard lists it as not in 8.0 for [migrations](../../../scorecard/15-migrations.md) and the [CLI](../../../scorecard/17-cli-commands.md), and the [`prisma-8` skill](../../../skills/prisma-8/references/migrations.md) sends users who need it to file an issue.

## Consequences

No revisit-if condition is recorded. The issues filed through the skill's feedback flow are the evidence a maintainer weighs when scheduling it.
