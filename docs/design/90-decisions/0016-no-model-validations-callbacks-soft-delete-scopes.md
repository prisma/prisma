# 0016 — No validations, lifecycle callbacks, soft delete or default scopes in the core

**Status:** `never`
**Decided by:** Will Madden, 2026-10-22

## The request

Features that ActiveRecord-style ORMs, such as Rails' Active Record or Sequelize, build into their models:

- **Validations:** rules declared on a model, such as `validates :email, presence: true`, checked before a write.
- **Lifecycle callbacks:** hooks a model declares that run around its writes, such as `beforeSave` or `afterCreate`.
- **Soft delete:** marking a model as soft-deleted (Sequelize's `paranoid: true`), so a delete sets a timestamp and reads hide those rows.
- **Default scopes:** a filter declared on a model that the ORM applies to every query on it, such as Rails' `default_scope`.

## The decision

Never in the core. Each of these can be built in an extension or in user space, and the core does not build a feature that can ([project intent](../00-purpose/project-intent.md#what-it-deliberately-does-not-do)). Will Madden on validations: "achievable in user space". On soft delete: "achievable in extension/user space". Lifecycle callbacks and default scopes are ruled out by the same rule.

An extension may offer any of them.

## What to use instead

- Validations: validate in application code, for example with arktype.
- Lifecycle callbacks: middleware on the runtime's lifecycle events (ADR 271), or application code.
- Soft delete: a nullable `deletedAt` column and a scope that hides deleted rows, applied with `with` (ADR 259 shows this as `notDeleted`).
- Default scopes: Prisma 8 already has named scopes. A scope is a query fragment that imposes conditions on a query (ADR 259), and an application can add its own query methods with a collection class (ADR 265). They apply where the code calls them, not silently on every query.

## Revisit if

Not recorded.

## Sources

- [project intent, what it deliberately does not do](../00-purpose/project-intent.md#what-it-deliberately-does-not-do)
- [`prisma-8` skill, contract.md](../../../skills/prisma-8/references/contract.md)
- [ADR 259](../../architecture%20docs/adrs/ADR%20259%20-%20Query%20fragments%20are%20functions.md)
- [ADR 265](../../architecture%20docs/adrs/ADR%20265%20-%20A%20collection%20keeps%20its%20class%20through%20the%20chain.md)
- [ADR 271](../../architecture%20docs/adrs/ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md)
