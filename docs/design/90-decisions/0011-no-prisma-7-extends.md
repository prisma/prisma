# 0011 — No Prisma 7 `$extends` client extensions

> **Draft — for maintainer acceptance.**

**Status:** `not-yet`

## The request

Use Prisma 7's `$extends` with result, client or model components, `$allModels`, or `defineExtension`.

## The decision

Not in 8.0. Prisma 8 extends behaviour through packages and middleware instead of one client-extension API.

## What to use instead

Middleware on the runtime's lifecycle events for logging, caching, tracing or rewriting queries (ADR 271). Extension packages for new types, functions and operators. A package can add methods to every collection of a model (ADR 272).

## Revisit if

Not recorded.

## Sources

- [scorecard: extensions, `$extends`](../../../scorecard/18-extensions.md)
- [ADR 271](../../architecture%20docs/adrs/ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md)
- [ADR 272](../../architecture%20docs/adrs/ADR%20272%20-%20Packages%20contribute%20collection%20methods%20computed%20from%20a%20model.md)
- [`prisma-8` skill, runtime.md](../../../skills/prisma-8/references/runtime.md)
- [README, For extension authors](../../../README.md#for-extension-authors)
