# ADR 293 — Validations, lifecycle callbacks, soft delete and default scopes are not in the core

**Status:** Accepted
**Date:** 2026-10-22
**Builds on:** [ADR 259 — Query fragments are functions](ADR%20259%20-%20Query%20fragments%20are%20functions.md), [ADR 265 — A collection keeps its class through the chain](ADR%20265%20-%20A%20collection%20keeps%20its%20class%20through%20the%20chain.md), [ADR 271 — The runtime middleware observes a tree of activities, each started, ended and finalized](ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md)

---

## Decision

Never in the core. Each can be built in an extension or in user code, and an extension may offer any of them. Use instead:

- Validations: validate in application code, for example with arktype.
- Lifecycle callbacks: middleware on the runtime's lifecycle events ([ADR 271](ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md)), or application code.
- Soft delete: a nullable `deletedAt` column and a scope that hides deleted rows, applied with `with` ([ADR 259](ADR%20259%20-%20Query%20fragments%20are%20functions.md) shows this as `notDeleted`).
- Default scopes: named scopes. A scope is a query fragment that imposes conditions on a query ([ADR 259](ADR%20259%20-%20Query%20fragments%20are%20functions.md)), and an application can add its own query methods with a collection class ([ADR 265](ADR%20265%20-%20A%20collection%20keeps%20its%20class%20through%20the%20chain.md)). They apply where the code calls them, not silently on every query.

## Context

ActiveRecord-style ORMs, such as Rails' Active Record or Sequelize, build these into their models, and users ask for them: validation rules declared on a model; hooks such as `beforeSave` or `afterCreate`; soft delete such as Sequelize's `paranoid: true`; and a filter applied to every query on a model, such as Rails' `default_scope`. Will Madden decided on 2026-10-22. On validations: "achievable in user space". On soft delete: "should be achievable in extension/user space". Lifecycle callbacks and default scopes fall under the same rule. Will Madden, 2026-10-22: "we will not build in the core features which can be built in extension/user space."

## Consequences

An extension may offer any of them, built on the public SPI. No revisit-if condition is recorded.
