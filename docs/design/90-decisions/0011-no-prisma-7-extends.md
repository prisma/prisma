# 0011 — No Prisma 7 `$extends` client extensions

**Status:** `never`
**Decided by:** Will Madden, 2026-10-22

## The request

Use Prisma 7's `$extends` with result, client or model components, `$allModels`, or `defineExtension`.

## The decision

Never. Prisma 8 has no `$extends`. Its behaviour is extended through packages and middleware, and the core does not take a second extension API for what those already cover. This rests on the rule that the core does not build a feature that can be built as an extension or in user space ([project intent](../00-purpose/project-intent.md#what-it-deliberately-does-not-do)).

## What to use instead

Middleware on the runtime's lifecycle events for logging, caching, tracing or rewriting queries (ADR 271). Extension packages for new types, functions and operators. A package can add methods to every collection of a model (ADR 272), and an application can add its own query methods with a collection class (ADR 265).

## Sources

- [project intent, what it deliberately does not do](../00-purpose/project-intent.md#what-it-deliberately-does-not-do)
- [scorecard: extensions, `$extends`](../../../scorecard/18-extensions.md)
- [ADR 271](../../architecture%20docs/adrs/ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md)
- [ADR 272](../../architecture%20docs/adrs/ADR%20272%20-%20Packages%20contribute%20collection%20methods%20computed%20from%20a%20model.md)
- [ADR 265](../../architecture%20docs/adrs/ADR%20265%20-%20A%20collection%20keeps%20its%20class%20through%20the%20chain.md)
- [`prisma-8` skill, runtime.md](../../../skills/prisma-8/references/runtime.md)
- [README, For extension authors](../../../README.md#for-extension-authors)
