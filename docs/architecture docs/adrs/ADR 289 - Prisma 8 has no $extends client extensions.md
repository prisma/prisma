# ADR 289 — Prisma 8 has no `$extends` client extensions

**Status:** Accepted
**Date:** 2026-10-22
**Builds on:** [ADR 271 — The runtime middleware observes a tree of activities, each started, ended and finalized](ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md), [ADR 272 — Packages contribute collection methods computed from a model](ADR%20272%20-%20Packages%20contribute%20collection%20methods%20computed%20from%20a%20model.md), [ADR 265 — A collection keeps its class through the chain](ADR%20265%20-%20A%20collection%20keeps%20its%20class%20through%20the%20chain.md)

---

## Decision

Never. Prisma 8 has no `$extends`. Its behaviour is extended through packages and middleware, and the core does not take a second extension API for what those already cover. Use instead: middleware on the runtime's lifecycle events for logging, caching, tracing or rewriting queries ([ADR 271](ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md)); extension packages for new types, functions and operators; a package can add methods to every collection of a model ([ADR 272](ADR%20272%20-%20Packages%20contribute%20collection%20methods%20computed%20from%20a%20model.md)), and an application can add its own query methods with a collection class ([ADR 265](ADR%20265%20-%20A%20collection%20keeps%20its%20class%20through%20the%20chain.md)).

## Context

Users ask for Prisma 7's `$extends` with result, client or model components, `$allModels`, or `defineExtension` ([scoreboard](../../../scorecard/18-extensions.md)). Will Madden decided on 2026-10-22: `$extends` will never be in Prisma 8. The decision rests on the rule that the core does not build a feature that can be built in an extension or in user space. Will Madden, 2026-10-22: "we will not build in the core features which can be built in extension/user space."

## Consequences

The client is extended through packages and middleware on the [public SPI](../../../README.md#for-extension-authors), and an application adds its own query methods with a collection class. No revisit-if condition is recorded.
