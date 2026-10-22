# 0016 — No model validations, lifecycle callbacks, soft delete or scopes

> **Draft — for maintainer acceptance.**

**Status:** `not-yet`

## The request

Declare validations on a model, run `beforeSave` or `afterCreate` callbacks, mark a model as soft-deleted (`paranoid: true`), or define default scopes, as ActiveRecord-style ORMs do.

## The decision

Not in 8.0. The contract describes data; it carries no executable logic.

## What to use instead

Validations: validate in application code with arktype. Callbacks: middleware or application code. Soft delete: a nullable `deletedAt` column, filtered explicitly in queries, in middleware, or with a query fragment that hides deleted rows (ADR 259). Scopes: your own query helper functions.

## Revisit if

Not recorded. The skill reference sends users who need this to file an issue through its feedback flow, so those issues are the evidence a maintainer weighs when scheduling it.

## Sources

- [`prisma-8` skill, contract.md](../../../skills/prisma-8/references/contract.md)
- [ADR 259](../../architecture%20docs/adrs/ADR%20259%20-%20Query%20fragments%20are%20functions.md)
- [Architecture Overview, Contract-first](../../Architecture%20Overview.md#contract-first)
